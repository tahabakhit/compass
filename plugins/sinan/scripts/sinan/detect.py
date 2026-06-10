from __future__ import annotations

import json
import subprocess
from pathlib import Path
from typing import Any

import yaml

from .policy import repo_type_names

PACKAGE_FILES = ["package.json", "pnpm-lock.yaml", "yarn.lock", "package-lock.json", "bun.lockb", "bun.lock"]
APP_HINTS = ["src", "app", "pages", "public", "index.html", "vite.config.js", "next.config.js"]
IGNORED_WORKSPACE_DIRS = {".git", ".planning", ".workflow-state", ".wiki", "docs", "node_modules", "vendor", ".venv"}


def exists(target: Path, relative_path: str) -> bool:
    return (target / relative_path).exists()


def is_dir(target: Path, relative_path: str) -> bool:
    return (target / relative_path).is_dir()


def read_package_json(target: Path) -> dict[str, Any] | None:
    package_path = target / "package.json"
    if not package_path.exists():
        return None
    try:
        return json.loads(package_path.read_text(encoding="utf8"))
    except Exception:
        return None


def read_agents_config(target: Path) -> dict[str, Any] | None:
    config_path = target / ".agents" / "config.yml"
    if not config_path.exists():
        return None
    try:
        data = yaml.safe_load(config_path.read_text(encoding="utf8"))
    except Exception:
        return None
    return data if isinstance(data, dict) else None


def has_git_repository(target: Path) -> bool:
    return (target / ".git").exists()


def git_output(target: Path, args: list[str]) -> str:
    try:
        return subprocess.check_output(["git", *args], cwd=target, text=True, stderr=subprocess.DEVNULL).strip()
    except Exception:
        return ""


def detect_package_manager(target: Path) -> str | None:
    if exists(target, "pnpm-lock.yaml"):
        return "pnpm"
    if exists(target, "yarn.lock"):
        return "yarn"
    if exists(target, "bun.lock") or exists(target, "bun.lockb"):
        return "bun"
    if exists(target, "package-lock.json") or exists(target, "package.json"):
        return "npm"
    return None


def detect_frameworks(target: Path, package_json: dict[str, Any] | None = None) -> list[str]:
    deps = {}
    if package_json:
        deps.update(package_json.get("dependencies") or {})
        deps.update(package_json.get("devDependencies") or {})
    frameworks: list[str] = []
    for name in ["next", "react", "vue", "svelte", "astro", "vite", "express", "fastify"]:
        if name in deps:
            frameworks.append(name)
    if exists(target, "next.config.js") or exists(target, "next.config.mjs"):
        frameworks.append("next")
    if exists(target, "vite.config.js") or exists(target, "vite.config.ts"):
        frameworks.append("vite")
    return sorted(set(frameworks))


def detect_repo_surfaces(repo_path: Path) -> dict[str, Any]:
    package_json = read_package_json(repo_path)
    agent_files = [name for name in ["AGENTS.md", "CLAUDE.md"] if exists(repo_path, name)]
    return {
        "hasReadme": exists(repo_path, "README.md"),
        "hasAdr": is_dir(repo_path, "docs/adr"),
        "hasAgentDocs": is_dir(repo_path, ".agents"),
        "hasLegacyAgentDocs": is_dir(repo_path, "docs/agents"),
        "hasReferenceDocs": is_dir(repo_path, "docs/reference"),
        "hasGithub": is_dir(repo_path, ".github"),
        "hasGithubCopilot": exists(repo_path, ".github/copilot-instructions.md"),
        "hasAgentFiles": bool(agent_files),
        "agentFiles": agent_files,
        "hasPlanning": is_dir(repo_path, ".planning"),
        "hasWorkflowState": is_dir(repo_path, ".workflow-state"),
        "hasWiki": is_dir(repo_path, ".wiki"),
        "hasPackageJson": package_json is not None,
        "packageManager": detect_package_manager(repo_path),
        "frameworks": detect_frameworks(repo_path, package_json),
    }


def parse_dirty_status(status: str) -> bool:
    return any(line.strip() and not line.startswith("## ") for line in status.splitlines())


def detect_nested_repos(target: Path) -> list[dict[str, Any]]:
    repos: list[dict[str, Any]] = []
    for entry in sorted(target.iterdir() if target.exists() else [], key=lambda item: item.name):
        if not entry.is_dir() or entry.name in IGNORED_WORKSPACE_DIRS:
            continue
        if not has_git_repository(entry):
            continue
        status = git_output(entry, ["status", "--short", "--branch"])
        repos.append(
            {
                "name": entry.name,
                "relativePath": entry.name,
                "branch": git_output(entry, ["branch", "--show-current"]) or None,
                "remote": git_output(entry, ["remote", "get-url", "origin"]) or None,
                "dirty": parse_dirty_status(status),
                "status": status,
                "surfaces": detect_repo_surfaces(entry),
            }
        )
    return repos


def detect_workspace(target: Path) -> dict[str, Any]:
    has_git = has_git_repository(target)
    repos = detect_nested_repos(target)
    if has_git and repos:
        kind = "repo-with-nested-repos"
    elif repos:
        kind = "workspace"
    elif has_git:
        kind = "repo"
    else:
        kind = "folder"
    return {"kind": kind, "repoCount": len(repos), "repos": repos}


def top_level_names(target: Path) -> set[str]:
    if not target.exists():
        return set()
    return {entry.name for entry in target.iterdir()}


def detect_repo_type(target: Path, explicit: str | None = None) -> str:
    if explicit and explicit != "auto":
        if explicit not in repo_type_names():
            raise ValueError(f"unknown repo type: {explicit}")
        return explicit
    workspace = detect_workspace(target)
    names = top_level_names(target)
    package_json = read_package_json(target)
    package_name = str((package_json or {}).get("name", "")).lower()
    if workspace["repoCount"] > 0 and workspace["kind"] in {"workspace", "repo-with-nested-repos"}:
        return "workspace"
    configured_type = (read_agents_config(target) or {}).get("repo_type")
    if configured_type in repo_type_names():
        return str(configured_type)
    if {".planning", ".workflow-state"} & names and "package.json" not in names and not any(name in names for name in APP_HINTS):
        return "workspace"
    if {"skills", "hooks", "hooks_src", ".codex-plugin"} & names or "plugin" in package_name:
        return "plugin"
    if "schemas" in names and "src" not in names:
        return "data-registry"
    if names and names <= {"README.md", "docs", ".git", ".github", ".agents", "AGENTS.md", "CLAUDE.md", "GLOSSARY.md"}:
        return "docs-only"
    if "bin" in (package_json or {}):
        return "cli"
    if "package.json" in names or any(name in names for name in APP_HINTS):
        return "application"
    return "library"

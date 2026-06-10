from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .audit_layout import audit_layout
from .detect import detect_repo_type, has_git_repository
from .policy import layout_rules
from .render import has_marker, mark_content, read_text, render_template, replace_marked, write_text


@dataclass(frozen=True)
class DesiredFile:
    path: str
    content: str
    create_if_missing: bool = True


WORKSPACE_DIRS = [".planning", ".workflow-state"]


def context(repo_type: str) -> dict[str, Any]:
    return {"repo_type": repo_type, "common_optional_dirs": layout_rules()["common_optional_dirs"]}


def desired_files(target: Path, repo_type: str, include_github: bool | None = None) -> list[DesiredFile]:
    ctx = context(repo_type)
    specs = [
        ("agents/config.yml.j2", ".agents/config.yml", "agent-config"),
        ("agents/README.md.j2", ".agents/README.md", "agent-scaffold"),
        ("agents/layout.md.j2", ".agents/layout.md", "agent-scaffold"),
        ("agents/workflow.md.j2", ".agents/workflow.md", "agent-scaffold"),
        ("agents/routing.md.j2", ".agents/routing.md", "agent-scaffold"),
        ("agents/review.md.j2", ".agents/review.md", "agent-scaffold"),
        ("agents/safety.md.j2", ".agents/safety.md", "agent-scaffold"),
        ("agents/surfaces/codex.md.j2", ".agents/surfaces/codex.md", "agent-scaffold"),
        ("agents/surfaces/claude.md.j2", ".agents/surfaces/claude.md", "agent-scaffold"),
        ("agents/surfaces/github-copilot.md.j2", ".agents/surfaces/github-copilot.md", "agent-scaffold"),
        ("root/AGENTS.md.j2", "AGENTS.md", "scaffold"),
        ("root/CLAUDE.md.j2", "CLAUDE.md", "scaffold"),
        ("root/GLOSSARY.md.j2", "GLOSSARY.md", "glossary-conventions"),
        ("root/adr-README.md.j2", "docs/adr/README.md", "adr-conventions"),
        ("root/reference-README.md.j2", "docs/reference/README.md", "reference-conventions"),
    ]
    github_enabled = include_github if include_github is not None else has_git_repository(target)
    if github_enabled:
        specs.extend(
            [
                ("github/copilot-instructions.md.j2", ".github/copilot-instructions.md", "github-template"),
                ("github/pull_request_template.md.j2", ".github/pull_request_template.md", "github-template"),
                ("github/labels.yml.j2", ".github/labels.yml", "github-labels"),
                ("github/agent-checks.yml.j2", ".github/workflows/agent-checks.yml", "agent-checks-workflow"),
                ("github/ISSUE_TEMPLATE/bug_report.md.j2", ".github/ISSUE_TEMPLATE/bug_report.md", "github-template"),
                ("github/ISSUE_TEMPLATE/feature_request.md.j2", ".github/ISSUE_TEMPLATE/feature_request.md", "github-template"),
                ("github/ISSUE_TEMPLATE/agent_task.md.j2", ".github/ISSUE_TEMPLATE/agent_task.md", "github-template"),
                ("github/ISSUE_TEMPLATE/config.yml.j2", ".github/ISSUE_TEMPLATE/config.yml", "github-template"),
            ]
        )
    return [
        DesiredFile(relative_path, mark_content(relative_path, marker, render_template(template, ctx)))
        for template, relative_path, marker in specs
    ]


def reconcile(target: Path, desired: DesiredFile, mode: str) -> tuple[str | None, dict[str, str] | None]:
    path = target / desired.path
    existing = read_text(path)
    if existing is None:
        if mode == "scaffold" and desired.create_if_missing:
            write_text(path, desired.content)
        if mode in {"audit", "enforce", "scaffold"} and desired.create_if_missing:
            return desired.path, None
        return None, None
    if existing == desired.content:
        return None, None
    if desired.path.startswith(".agents/"):
        if mode in {"scaffold", "update"}:
            write_text(path, desired.content)
            return desired.path, None
        return desired.path, None
    if has_marker(existing):
        if mode in {"scaffold", "update"}:
            next_content = replace_marked(existing, desired.content)
            if next_content != existing:
                write_text(path, next_content)
                return desired.path, None
            return None, {"path": desired.path, "reason": "Sinan marker did not match this generated surface"}
        return desired.path, None
    if mode == "update":
        return None, {"path": desired.path, "reason": "manual file has no Sinan marker"}
    return desired.path, {"path": desired.path, "reason": "manual file has no Sinan marker"}


def run(
    target: str | Path,
    mode: str = "audit",
    repo_type: str | None = None,
    include_github: bool | None = None,
    parent_workspace: bool = False,
) -> dict[str, Any]:
    resolved = Path(target).resolve()
    if mode not in {"audit", "scaffold", "update", "enforce"}:
        raise ValueError(f"unknown scaffold mode: {mode}")
    if not resolved.is_dir():
        raise ValueError(f"target must be a directory: {resolved}")
    detected_type = detect_repo_type(resolved, repo_type or "auto")
    changed: list[str] = []
    skipped: list[dict[str, str]] = []
    for desired in desired_files(resolved, detected_type, include_github=include_github):
        stale, skip = reconcile(resolved, desired, mode)
        if stale:
            changed.append(stale)
        if skip:
            skipped.append(skip)
    if detected_type == "workspace":
        for relative_path in WORKSPACE_DIRS:
            path = resolved / relative_path
            if path.exists() and not path.is_dir():
                skipped.append({"path": relative_path, "reason": "expected workspace directory is a file"})
            elif not path.exists():
                if mode == "scaffold":
                    path.mkdir(parents=True)
                if mode in {"audit", "enforce", "scaffold"}:
                    changed.append(relative_path)
    stale_for_warnings = changed if mode in {"audit", "enforce"} else []
    warnings = audit_layout(resolved, detected_type, stale_for_warnings, skipped, parent_workspace=parent_workspace)
    ok = mode != "enforce" or (not changed and not warnings and not skipped)
    return {
        "target": str(resolved),
        "repoType": detected_type,
        "mode": mode,
        "changed": changed,
        "skipped": skipped,
        "warnings": warnings,
        "ok": ok,
    }


def render_text(result: dict[str, Any]) -> str:
    action = {
        "audit": "instruction scaffold audit complete",
        "scaffold": "instruction scaffold written",
        "update": "instruction scaffold update complete",
        "enforce": "instruction scaffold check passed" if result["ok"] else "instruction scaffold is stale",
    }[result["mode"]]
    lines = [action, f"repo type: {result['repoType']}"]
    if result["changed"]:
        lines.append(f"changed: {', '.join(result['changed'])}")
    if result["warnings"]:
        lines.append("warnings:")
        lines.extend(f"  {warning['path']}: {warning['message']}" for warning in result["warnings"])
    return "\n".join(lines)

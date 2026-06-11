from __future__ import annotations

import difflib
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .audit_layout import audit_layout
from .detect import detect_repo_type, has_git_repository, nested_under_workspace
from .policy import layout_rules
from .render import has_marker, mark_content, read_text, render_template, replace_marked, write_text


@dataclass(frozen=True)
class DesiredFile:
    path: str
    content: str
    create_if_missing: bool = True


WORKSPACE_DIRS = [".planning", ".workflow-state"]
ROOT_ENTRYPOINTS = {"AGENTS.md", "CLAUDE.md"}
GITHUB_MODES = {"none", "minimal", "guided"}

AGENT_AND_ROOT_SPECS = [
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
# Minimal default: only a CI check that agent surfaces stay in sync.
MINIMAL_GITHUB_SPECS = [
    ("github/agent-checks.yml.j2", ".github/workflows/agent-checks.yml", "agent-checks-workflow"),
]
# Guided bundle: written only after Sinan interrogates repo purpose.
GUIDED_GITHUB_SPECS = MINIMAL_GITHUB_SPECS + [
    ("github/copilot-instructions.md.j2", ".github/copilot-instructions.md", "github-template"),
    ("github/pull_request_template.md.j2", ".github/pull_request_template.md", "github-template"),
    ("github/labels.yml.j2", ".github/labels.yml", "github-labels"),
    ("github/ISSUE_TEMPLATE/bug_report.md.j2", ".github/ISSUE_TEMPLATE/bug_report.md", "github-template"),
    ("github/ISSUE_TEMPLATE/feature_request.md.j2", ".github/ISSUE_TEMPLATE/feature_request.md", "github-template"),
    ("github/ISSUE_TEMPLATE/agent_task.md.j2", ".github/ISSUE_TEMPLATE/agent_task.md", "github-template"),
    ("github/ISSUE_TEMPLATE/config.yml.j2", ".github/ISSUE_TEMPLATE/config.yml", "github-template"),
]


def context(repo_type: str) -> dict[str, Any]:
    return {"repo_type": repo_type, "common_optional_dirs": layout_rules()["common_optional_dirs"]}


def resolve_github_mode(target: Path, github: str | None = None, include_github: bool | None = None) -> str:
    if github is not None:
        if github not in GITHUB_MODES:
            raise ValueError(f"unknown github mode: {github}")
        return github
    if include_github is True:
        return "guided"
    if include_github is False:
        return "none"
    return "minimal" if has_git_repository(target) else "none"


def desired_files(
    target: Path,
    repo_type: str,
    github: str | None = None,
    include_github: bool | None = None,
) -> list[DesiredFile]:
    ctx = context(repo_type)
    github_mode = resolve_github_mode(target, github, include_github)
    specs = list(AGENT_AND_ROOT_SPECS)
    if github_mode == "minimal":
        specs += MINIMAL_GITHUB_SPECS
    elif github_mode == "guided":
        specs += GUIDED_GITHUB_SPECS
    return [
        DesiredFile(relative_path, mark_content(relative_path, marker, render_template(template, ctx)))
        for template, relative_path, marker in specs
    ]


def entrypoint_direction_ok(relative_path: str, existing: str) -> bool:
    """Canonical direction is CLAUDE.md importing @AGENTS.md (not the reverse)."""
    if relative_path == "CLAUDE.md":
        head = "\n".join(existing.splitlines()[:6]).lower()
        return "@agents.md" in head
    if relative_path == "AGENTS.md":
        return "@claude.md" not in existing.lower()
    return True


def entrypoint_diff(existing: str, desired: str, relative_path: str) -> str:
    diff = difflib.unified_diff(
        existing.splitlines(),
        desired.splitlines(),
        fromfile=f"a/{relative_path}",
        tofile=f"b/{relative_path}",
        lineterm="",
    )
    return "\n".join(list(diff)[:200])


def reconcile(
    target: Path,
    desired: DesiredFile,
    mode: str,
    replace_entrypoints: bool = False,
) -> tuple[str | None, dict[str, str] | None, dict[str, Any] | None]:
    path = target / desired.path
    existing = read_text(path)
    if existing is None:
        if mode == "scaffold" and desired.create_if_missing:
            write_text(path, desired.content)
        if mode in {"audit", "enforce", "scaffold"} and desired.create_if_missing:
            return desired.path, None, None
        return None, None, None
    if existing == desired.content:
        return None, None, None
    if desired.path.startswith(".agents/"):
        if mode in {"scaffold", "update"}:
            write_text(path, desired.content)
            return desired.path, None, None
        return desired.path, None, None
    if has_marker(existing):
        if mode in {"scaffold", "update"}:
            next_content = replace_marked(existing, desired.content)
            if next_content != existing:
                write_text(path, next_content)
                return desired.path, None, None
            return None, {"path": desired.path, "reason": "Sinan marker did not match this generated surface"}, None
        return desired.path, None, None
    # Unmarked existing file. Root entrypoints get a repair proposal (D-D) in audit/scaffold/
    # enforce; update stays marked-only and preserves manual files silently. Other manual files
    # are always preserved.
    if desired.path in ROOT_ENTRYPOINTS and mode != "update":
        wrong = not entrypoint_direction_ok(desired.path, existing)
        if mode == "scaffold" and replace_entrypoints:
            write_text(path, desired.content)
            return desired.path, None, None
        reason = (
            "wrong-direction entrypoint: CLAUDE.md should import @AGENTS.md and AGENTS.md must not import CLAUDE.md"
            if wrong
            else "manual entrypoint has no Sinan marker; rerun with --replace-entrypoints to adopt the managed layout"
        )
        proposal = {
            "path": desired.path,
            "reason": reason,
            "wrongDirection": wrong,
            "diff": entrypoint_diff(existing, desired.content, desired.path),
        }
        return desired.path, {"path": desired.path, "reason": reason}, proposal
    if desired.path in ROOT_ENTRYPOINTS and mode == "update" and replace_entrypoints:
        write_text(path, desired.content)
        return desired.path, None, None
    if mode == "update":
        return None, {"path": desired.path, "reason": "manual file has no Sinan marker"}, None
    return desired.path, {"path": desired.path, "reason": "manual file has no Sinan marker"}, None


def run(
    target: str | Path,
    mode: str = "audit",
    repo_type: str | None = None,
    include_github: bool | None = None,
    github: str | None = None,
    parent_workspace: bool = False,
    replace_entrypoints: bool = False,
) -> dict[str, Any]:
    resolved = Path(target).resolve()
    if mode not in {"audit", "scaffold", "update", "enforce"}:
        raise ValueError(f"unknown scaffold mode: {mode}")
    if not resolved.is_dir():
        raise ValueError(f"target must be a directory: {resolved}")
    detected_type = detect_repo_type(resolved, repo_type or "auto")
    nested = nested_under_workspace(resolved)
    changed: list[str] = []
    skipped: list[dict[str, str]] = []
    proposals: list[dict[str, Any]] = []
    for desired in desired_files(resolved, detected_type, github=github, include_github=include_github):
        stale, skip, proposal = reconcile(resolved, desired, mode, replace_entrypoints=replace_entrypoints)
        if stale:
            changed.append(stale)
        if skip:
            skipped.append(skip)
        if proposal:
            proposals.append(proposal)
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
    warnings = audit_layout(
        resolved,
        detected_type,
        stale_for_warnings,
        skipped,
        parent_workspace=parent_workspace,
        nested=nested,
    )
    ok = mode != "enforce" or (not changed and not warnings and not skipped)
    return {
        "target": str(resolved),
        "repoType": detected_type,
        "mode": mode,
        "changed": changed,
        "skipped": skipped,
        "warnings": warnings,
        "proposals": proposals,
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
    if result.get("proposals"):
        lines.append("entrypoint repairs proposed (rerun with --replace-entrypoints to apply):")
        for proposal in result["proposals"]:
            lines.append(f"  {proposal['path']}: {proposal['reason']}")
    if result["warnings"]:
        lines.append("warnings:")
        lines.extend(f"  {warning['path']}: {warning['message']}" for warning in result["warnings"])
    return "\n".join(lines)

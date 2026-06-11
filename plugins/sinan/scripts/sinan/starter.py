"""Gated, plan-first starter helper (D-E).

Starter does not write app files. Sinan does not own every framework's starter,
so app code stays agent-written. This module enforces the gates (scaffold present,
decisions confirmed) and emits a recommended minimal file outline that the agent
confirms before generating anything.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

from .detect import detect_repo_type

# Minimal, framework-agnostic outlines per repo type. These are recommendations the
# agent confirms and fills in -- not templates Sinan writes.
PLANNED_OUTLINE = {
    "application": [
        "project/config (manifest, dependency, and tool config)",
        "source entry point (smallest runnable app)",
        "one real route/page/command",
        "starter test for that slice",
        "run + test scripts",
    ],
    "library": [
        "package manifest and tool config",
        "public API module with one real function",
        "usage example",
        "starter test for the public API",
        "build/packaging script",
    ],
    "cli": [
        "package manifest and console-script entry",
        "argument parsing + one real command",
        "starter test for that command",
        "run + test scripts",
    ],
    "plugin": [
        "plugin manifest(s)",
        "one real skill or command surface",
        "starter test or smoke check",
    ],
    "data-registry": [
        "schema/catalog layout",
        "one real schema or dataset manifest",
        "validation script + starter test",
    ],
    "docs-only": [
        "docs index and section layout",
        "one real reference page",
    ],
    "workspace": [
        "(workspace) prefer per-child-repo starters; the workspace root coordinates, it does not host app code",
    ],
}
DEFAULT_OUTLINE = PLANNED_OUTLINE["application"]


def scaffold_present(target: Path) -> bool:
    return (target / ".agents" / "config.yml").exists() and (target / "AGENTS.md").exists()


def has_confirmed_decisions(target: Path) -> bool:
    adr = target / "docs" / "adr"
    if adr.is_dir():
        for candidate in adr.iterdir():
            if candidate.is_file() and candidate.suffix == ".md" and candidate.name.lower() != "readme.md":
                return True
    planning = target / ".planning"
    if planning.is_dir():
        for candidate in planning.rglob("*.md"):
            if candidate.is_file():
                return True
    return False


def build_plan(
    target: str | Path,
    repo_type: str | None = None,
    decisions_confirmed: bool = False,
) -> dict[str, Any]:
    resolved = Path(target).resolve()
    if not resolved.is_dir():
        raise ValueError(f"target must be an existing directory: {resolved}")
    detected_type = detect_repo_type(resolved, repo_type or "auto")
    has_scaffold = scaffold_present(resolved)
    decisions = bool(decisions_confirmed) or has_confirmed_decisions(resolved)
    blocked: list[str] = []
    if not has_scaffold:
        blocked.append("scaffold missing: run `sinan scaffold --target <repo>` so agent policy exists before app files")
    if not decisions:
        blocked.append(
            "decisions not confirmed: capture product/stack decisions (docs/adr/ or .planning/), or pass --decisions-confirmed after confirming them with the user"
        )
    outline = PLANNED_OUTLINE.get(detected_type, DEFAULT_OUTLINE)
    return {
        "target": str(resolved),
        "repoType": detected_type,
        "writesFiles": False,
        "gates": {"scaffoldPresent": has_scaffold, "decisionsConfirmed": decisions},
        "ok": not blocked,
        "blocked": blocked,
        "plannedFiles": list(outline),
        "guidance": (
            "Starter does not write files. After the gates pass and the user confirms the planned outline, "
            "the agent generates the smallest useful app shell, then hands off to $tdd for the first real slice."
        ),
    }


def render_text(plan: dict[str, Any]) -> str:
    lines = [
        "starter plan (no files written)",
        f"target: {plan['target']}",
        f"repo type: {plan['repoType']}",
        f"gates: scaffoldPresent={plan['gates']['scaffoldPresent']} decisionsConfirmed={plan['gates']['decisionsConfirmed']}",
    ]
    if plan["blocked"]:
        lines.append("blocked:")
        lines.extend(f"  - {reason}" for reason in plan["blocked"])
    else:
        lines.append("gates passed; confirm the planned outline before generating files:")
        lines.extend(f"  - {item}" for item in plan["plannedFiles"])
    return "\n".join(lines)

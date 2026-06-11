from __future__ import annotations

from pathlib import Path
from typing import Any

from .detect import exists
from .policy import bad_patterns


def audit_layout(
    target: Path,
    repo_type: str,
    stale_paths: list[str] | None = None,
    skipped: list[dict[str, str]] | None = None,
    parent_workspace: bool = False,
    nested: bool = False,
) -> list[dict[str, str]]:
    warnings: list[dict[str, str]] = []
    for pattern in bad_patterns():
        if exists(target, pattern["path"]):
            warnings.append({"path": pattern["path"], "message": pattern["message"]})
    # State dirs are expected for standalone repos and workspace roots (D-C). Warn only for
    # repos nested under a workspace parent, or when auditing from the parent's perspective.
    if parent_workspace or (nested and repo_type != "workspace"):
        if exists(target, ".planning"):
            warnings.append(
                {
                    "path": ".planning",
                    "message": "Child repo .planning/ should live in the parent workspace; keep cross-repo plans and handoffs there.",
                }
            )
        if exists(target, ".workflow-state"):
            warnings.append(
                {
                    "path": ".workflow-state",
                    "message": "Child repo .workflow-state/ should live in the parent workspace; generated run state belongs there.",
                }
            )
    for path in stale_paths or []:
        warnings.append({"path": path, "message": "Generated scaffold is missing or stale."})
    for item in skipped or []:
        warnings.append({"path": item["path"], "message": f"Skipped generated update: {item['reason']}."})
    return warnings

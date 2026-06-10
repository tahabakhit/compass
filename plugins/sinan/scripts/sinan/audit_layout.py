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
) -> list[dict[str, str]]:
    warnings: list[dict[str, str]] = []
    for pattern in bad_patterns():
        if exists(target, pattern["path"]):
            warnings.append({"path": pattern["path"], "message": pattern["message"]})
    if repo_type != "workspace" or parent_workspace:
        if exists(target, ".planning"):
            warnings.append(
                {
                    "path": ".planning",
                    "message": "Repo-local .planning/ is usually workspace-level; child repo planning and handoffs should live in the parent workspace.",
                }
            )
        if exists(target, ".workflow-state"):
            warnings.append(
                {
                    "path": ".workflow-state",
                    "message": "Repo-local .workflow-state/ should contain only generated runtime JSON from runs launched in this repo.",
                }
            )
    for path in stale_paths or []:
        warnings.append({"path": path, "message": "Generated scaffold is missing or stale."})
    for item in skipped or []:
        warnings.append({"path": item["path"], "message": f"Skipped generated update: {item['reason']}."})
    return warnings

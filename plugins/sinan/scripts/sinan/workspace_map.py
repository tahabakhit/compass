from __future__ import annotations

import json
from pathlib import Path
from typing import Any


def build_workspace_map(report: dict[str, Any]) -> dict[str, Any]:
    workspace = report["signals"]["workspace"]
    return {
        "schemaVersion": 1,
        "target": report["target"],
        "kind": workspace["kind"],
        "repoCount": workspace["repoCount"],
        "repos": workspace["repos"],
        "policy": report["workspacePolicy"],
    }


def workspace_map_path(target: Path) -> Path:
    return target / ".workflow-state" / "plans" / "workspace-map.json"


def workspace_summary_path(target: Path) -> Path:
    return target / ".planning" / "workspace.md"


def write_workspace_map(report: dict[str, Any]) -> Path:
    path = workspace_map_path(Path(report["target"]))
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(build_workspace_map(report), indent=2) + "\n", encoding="utf8")
    return path


def render_workspace_summary(report: dict[str, Any]) -> str:
    rows = []
    for repo in report["signals"]["workspace"]["repos"]:
        surfaces = repo["surfaces"]
        rows.append(
            "| {name} | {branch} | {dirty} | {adr} | {agents} | {github} | {planning} | {workflow_state} |".format(
                name=repo["relativePath"],
                branch=repo.get("branch") or "-",
                dirty="yes" if repo.get("dirty") else "no",
                adr="yes" if surfaces.get("hasAdr") else "no",
                agents="yes" if surfaces.get("hasAgentDocs") else "no",
                github="yes" if surfaces.get("hasGithub") else "no",
                planning="warn" if surfaces.get("hasPlanning") else "no",
                workflow_state="warn" if surfaces.get("hasWorkflowState") else "no",
            )
        )
    table = "\n".join(rows) or "| _none_ | - | - | - | - | - | - | - |"
    return f"""# Workspace Map

Target: `{report['target']}`

| Repo | Branch | Dirty | ADRs | Agents | GitHub | Planning | Workflow State |
| --- | --- | --- | --- | --- | --- | --- | --- |
{table}

## Policy

- Workspace `.planning/` is for cross-repo brainstorms, plans, reviews, campaigns, and handoffs.
- Workspace `.workflow-state/` is for generated workspace maps, bootstrap reports, and run state.
- Repo-specific ADRs stay in each child repo's `docs/adr/`.
- Child `.agents/`, `docs/reference/`, `.github/`, `AGENTS.md`, `CLAUDE.md`, and `.github/copilot-instructions.md` are repo-canonical surfaces when present.
- Avoid child `.planning/` unless the child repo is being operated as its own workspace.
"""


def write_workspace_summary(report: dict[str, Any]) -> Path:
    path = workspace_summary_path(Path(report["target"]))
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(render_workspace_summary(report), encoding="utf8")
    return path

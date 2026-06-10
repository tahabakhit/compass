from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .detect import (
    APP_HINTS,
    PACKAGE_FILES,
    detect_frameworks,
    detect_package_manager,
    detect_repo_type,
    detect_repo_surfaces,
    detect_workspace,
    exists,
    is_dir,
    read_package_json,
)
from .workspace_map import write_workspace_map, write_workspace_summary

PLANNING_HANDOFF_DIR = ".planning/handoffs"
RUN_DIRS = [".workflow-state/runs"]
WORKSPACE_POLICY = {
    "planning": "Use workspace .planning/ for cross-repo brainstorms, plans, reviews, campaigns, and handoffs.",
    "workflowState": "Use workspace .workflow-state/ for generated workspace maps, bootstrap reports, and run state.",
    "repoDecisions": "Keep repo-specific architecture decisions in each child repo's docs/adr/. Use workspace docs/adr/ only for decisions that affect more than one repo.",
    "repoCanonicalDocs": "Treat child docs/adr/, docs/reference/, .agents/, .github/, AGENTS.md, CLAUDE.md, and .github/copilot-instructions.md as canonical repo-local documentation surfaces when present.",
    "wiki": "Use repo .wiki/ for repo-local durable knowledge and ~/.wiki/ for personal or cross-project durable knowledge.",
}


def _relative_files(path: Path, root: Path) -> list[str]:
    if not path.exists():
        return []
    if path.is_file():
        return [str(path.relative_to(root))]
    return sorted(str(candidate.relative_to(root)) for candidate in path.iterdir() if candidate.is_file())


def detect_handoffs(target: Path) -> dict[str, Any]:
    planning = _relative_files(target / PLANNING_HANDOFF_DIR, target)
    run_dirs = [relative for relative in RUN_DIRS if (target / relative).is_dir()]
    files = [*planning]
    found = bool(planning or run_dirs)
    return {"found": found, "planningHandoffs": planning, "runDirs": run_dirs, "files": files}


def classify_state(signals: dict[str, Any]) -> str:
    if signals["handoffs"]["found"]:
        return "resumed-from-handoff"
    if signals.get("repoType") == "workspace":
        return "workspace"
    if signals["workspace"]["repoCount"] > 0 and signals["workspace"]["kind"] in {"workspace", "repo-with-nested-repos"}:
        return "workspace"
    if signals["appHints"]:
        return "app-started"
    top_level = [name for name in signals["topLevel"] if name not in {".git", ".DS_Store"}]
    if not top_level:
        return "empty"
    foundation = {"README.md", "LICENSE", "AGENTS.md", "CLAUDE.md", ".agents", ".github", "docs", "GLOSSARY.md"}
    if set(top_level).issubset(foundation):
        return "foundation-only"
    return "established"


def recommend_steps(state: str, signals: dict[str, Any]) -> dict[str, Any]:
    steps: list[str] = []
    skipped: list[dict[str, str]] = []
    is_workspace = state == "workspace"
    if signals["handoffs"]["found"]:
        steps.append("handoff")
    if state in {"empty", "foundation-only"}:
        if not is_workspace:
            steps.extend(["brainstorm", "decision-capture", "architecture"])
        else:
            steps.append("architecture")
    elif state == "workspace":
        skipped.append({"step": "decision-capture", "reason": "Workspace roots coordinate child repos; capture repo-specific decisions in child docs/adr/."})
    elif not signals["hasGlossary"] and not signals["hasAdr"]:
        steps.extend(["brainstorm", "decision-capture"])
    else:
        skipped.append({"step": "decision-capture", "reason": "Project memory already exists; update only if decisions changed."})
    if state == "workspace" and signals["hasAdr"]:
        skipped.append({"step": "architecture", "reason": "Workspace ADR directory exists; use it only for cross-repo decisions."})
    elif state == "workspace":
        skipped.append({"step": "architecture", "reason": "Workspace root has no cross-repo ADR need by default."})
    elif not signals["hasAdr"]:
        steps.append("architecture")
    else:
        skipped.append({"step": "architecture", "reason": "ADR directory exists; inspect before adding new decisions."})
    if not signals["hasAgentsDir"] or not signals["hasAgentFiles"]:
        steps.append("scaffold")
    else:
        skipped.append({"step": "scaffold", "reason": "Agent policy bundle already exists; run scaffold only to refresh."})
    if state in {"empty", "foundation-only"} and not is_workspace:
        steps.append("starter")
    else:
        skipped.append({"step": "starter", "reason": "Existing app, workspace, or established files detected; starter generation is not the default."})
    if state in {"app-started", "established", "resumed-from-handoff"}:
        steps.append("tdd")
    deduped = list(dict.fromkeys(steps))
    return {"nextSteps": deduped, "skipped": skipped}


def command_for_step(step: str, target: Path) -> str:
    quoted = str(target)
    return {
        "handoff": "Read the latest handoff before changing files.",
        "brainstorm": "Use $brainstorm to clarify users, constraints, non-goals, and first vertical slice.",
        "decision-capture": "Use $decision-capture after terms or decisions stabilize.",
        "architecture": "Use $architecture to choose boundaries, modules, data shape, integrations, and first slice.",
        "scaffold": f"python3 -m scripts.sinan.cli scaffold --target {quoted}",
        "starter": "Use $starter after decisions are confirmed.",
        "tdd": "Use $tdd for the next verified implementation slice.",
    }[step]


def build_plan(state: str, signals: dict[str, Any], recommendations: dict[str, Any], target: Path) -> list[dict[str, str]]:
    return [
        {
            "step": step,
            "reason": reason_for_step(step, state, signals),
            "command": command_for_step(step, target),
        }
        for step in recommendations["nextSteps"]
    ]


def reason_for_step(step: str, state: str, signals: dict[str, Any]) -> str:
    if step == "handoff":
        return "Prior handoff or run state exists; read it before continuing."
    if step == "brainstorm":
        return "No durable product or architecture memory was detected."
    if step == "decision-capture":
        return "No GLOSSARY.md or ADR directory was detected; stable terms and decisions need a home."
    if step == "architecture":
        return "No ADR directory was detected; choose boundaries before starter or implementation work."
    if step == "scaffold":
        return ".agents/ and short agent entrypoints were not fully detected; agent guidance should be created or refreshed."
    if step == "starter":
        return "Repo is empty or foundation-only; starter files may be appropriate after decisions are confirmed."
    if step == "tdd":
        return "Continue with the next verified implementation slice."
    return "Recommended by bootstrap."


def workspace_warnings(workspace: dict[str, Any]) -> list[dict[str, str]]:
    warnings: list[dict[str, str]] = []
    for repo in workspace.get("repos") or []:
        surfaces = repo.get("surfaces") or {}
        if surfaces.get("hasPlanning"):
            warnings.append(
                {
                    "path": f"{repo['relativePath']}/.planning",
                    "message": "Child repo has .planning/; cross-repo plans and handoffs should usually live in the parent workspace.",
                }
            )
        if surfaces.get("hasWorkflowState"):
            warnings.append(
                {
                    "path": f"{repo['relativePath']}/.workflow-state",
                    "message": "Child repo has .workflow-state/; workspace maps and generated run state should usually live in the parent workspace.",
                }
            )
    return warnings


def build_report(target: str | Path) -> dict[str, Any]:
    resolved = Path(target).resolve()
    if not resolved.is_dir():
        raise ValueError(f"target must be an existing directory: {resolved}")
    package_json = read_package_json(resolved)
    top_level = sorted(entry.name for entry in resolved.iterdir()) if resolved.exists() else []
    workspace = detect_workspace(resolved)
    handoffs = detect_handoffs(resolved)
    app_hints = [relative for relative in APP_HINTS if exists(resolved, relative)]
    repo_type = detect_repo_type(resolved)
    signals = {
        "topLevel": top_level,
        "repoType": repo_type,
        "workspace": workspace,
        "handoffs": handoffs,
        "packageFiles": [relative for relative in PACKAGE_FILES if exists(resolved, relative)],
        "packageManager": detect_package_manager(resolved),
        "frameworks": detect_frameworks(resolved, package_json),
        "appHints": app_hints,
        "hasAgentFiles": exists(resolved, "AGENTS.md") or exists(resolved, "CLAUDE.md"),
        "agentFiles": [relative for relative in ["AGENTS.md", "CLAUDE.md"] if exists(resolved, relative)],
        "hasAgentsDir": is_dir(resolved, ".agents"),
        "hasGlossary": exists(resolved, "GLOSSARY.md"),
        "hasAdr": is_dir(resolved, "docs/adr"),
        "hasLegacyAgentDocs": is_dir(resolved, "docs/agents"),
        "surfaces": detect_repo_surfaces(resolved),
    }
    state = classify_state(signals)
    recommendations = recommend_steps(state, signals)
    return {
        "schemaVersion": 1,
        "target": str(resolved),
        "state": state,
        "signals": signals,
        "warnings": workspace_warnings(workspace),
        "workspacePolicy": WORKSPACE_POLICY,
        "recommendations": recommendations,
        "plan": build_plan(state, signals, recommendations, resolved),
    }


def write_plan_output(report: dict[str, Any], output: str | None = None) -> Path:
    path = Path(output).resolve() if output else Path(report["target"]) / ".workflow-state" / "plans" / "bootstrap-report.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf8")
    return path


def persist_report(report: dict[str, Any], output: str | None = None) -> dict[str, str]:
    written = {"bootstrapReport": str(write_plan_output(report, output))}
    if report["signals"]["repoType"] == "workspace" or report["signals"]["workspace"]["repoCount"] > 0:
        written["workspaceMap"] = str(write_workspace_map(report))
        written["workspaceSummary"] = str(write_workspace_summary(report))
    return written


def render_text(report: dict[str, Any]) -> str:
    lines = [
        "bootstrap report",
        f"target: {report['target']}",
        f"state: {report['state']}",
        f"workspace: {report['signals']['workspace']['kind']} ({report['signals']['workspace']['repoCount']} child repos)",
        f"next steps: {', '.join(report['recommendations']['nextSteps']) or 'none'}",
    ]
    if report.get("warnings"):
        lines.append("warnings:")
        lines.extend(f"  {warning['path']}: {warning['message']}" for warning in report["warnings"])
    return "\n".join(lines)

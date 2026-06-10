from __future__ import annotations

import hashlib
import json
import time
from pathlib import Path
from typing import Any

import yaml

from . import ROOT
from .schemas import assert_valid, assert_workflow_semantics


def workflow_files() -> list[Path]:
    return sorted((ROOT / "workflows").glob("*.yaml"))


def read_workflow(path_or_id: str | Path) -> dict[str, Any]:
    path = Path(path_or_id)
    if not path.suffix:
        path = ROOT / "workflows" / f"{path_or_id}.yaml"
    if not path.is_absolute():
        path = ROOT / path
    return yaml.safe_load(path.read_text(encoding="utf8"))


def validate_workflow(path_or_id: str | Path) -> dict[str, Any]:
    workflow = read_workflow(path_or_id)
    label = str(path_or_id)
    assert_valid("https://sinan.local/schemas/workflow.schema.json", workflow, label)
    assert_workflow_semantics(workflow, label)
    return workflow


def validate_all_workflows() -> list[dict[str, Any]]:
    return [validate_workflow(path) for path in workflow_files()]


def format_json(value: Any) -> str:
    return json.dumps(value, indent=2) + "\n"


def build_runtime_data(check: bool = False) -> dict[str, Any]:
    outputs: dict[str, Any] = {
        "runtime/routes/rules.json": yaml.safe_load((ROOT / "routes/rules.yaml").read_text(encoding="utf8")),
        "runtime/benchmarks/observed-usage.json": yaml.safe_load((ROOT / "benchmarks/observed-usage.yaml").read_text(encoding="utf8")),
    }
    workflow_ids = []
    for file in workflow_files():
        workflow = yaml.safe_load(file.read_text(encoding="utf8"))
        workflow_ids.append(workflow["id"])
        outputs[f"runtime/workflows/{workflow['id']}.json"] = workflow
    outputs["runtime/workflows/index.json"] = {"workflows": workflow_ids}
    stale = []
    for relative, value in outputs.items():
        path = ROOT / relative
        expected = format_json(value)
        if check:
            actual = path.read_text(encoding="utf8") if path.exists() else None
            if actual != expected:
                stale.append(relative)
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(expected, encoding="utf8")
    if stale:
        raise AssertionError(f"runtime data is stale: {', '.join(stale)}")
    return {"workflows": workflow_ids}


def default_capabilities(platform: str) -> dict[str, bool]:
    return {"planMode": True, "subagents": True, "dynamicWorkflows": platform == "claude", "hooks": True, "mcp": True}


def expand_phases(workflow: dict[str, Any], conditions: list[str]) -> list[dict[str, Any]]:
    condition_set = set(conditions)
    return [
        {"index": index + 1, "id": phase["id"], "conditional": bool(phase.get("when")), "when": phase.get("when")}
        for index, phase in enumerate(phase for phase in workflow["phases"] if not phase.get("when") or phase.get("when") in condition_set)
    ]


def select_native_mode(workflow: dict[str, Any], platform: str, capabilities: dict[str, bool]) -> str:
    native = (workflow.get("native") or {}).get(platform, "none")
    if platform == "claude":
        if native == "dynamic_workflow_optional" and capabilities.get("dynamicWorkflows"):
            return "claude-dynamic-workflow"
        if native in {"plan_mode_optional", "plan_mode_required"} and capabilities.get("planMode"):
            return "claude-plan"
        return "none"
    if native in {"plan_mode_optional", "plan_mode_required"} and capabilities.get("planMode"):
        return "codex-plan"
    if native == "subagents_allowed" and capabilities.get("subagents"):
        return "codex-subagents"
    return "none"


def create_run_id(workflow_id: str, target: Path, stable: bool = True) -> str:
    if stable:
        return f"{workflow_id}-dry-run"
    digest = hashlib.sha256(f"{workflow_id}:{target.resolve()}:{time.time()}".encode()).hexdigest()[:12]
    return f"{workflow_id}-{digest}"


def create_dry_run_plan(workflow: dict[str, Any], options: dict[str, Any]) -> dict[str, Any]:
    target = Path(options.get("target") or Path.cwd()).resolve()
    platform = options.get("platform", "codex")
    capabilities = options.get("capabilities") or default_capabilities(platform)
    if workflow["mode"]["default"] == "large" and workflow["budget"].get("confirmation_required") and not options.get("confirmation"):
        raise ValueError(f"Workflow {workflow['id']} is large and requires confirmation")
    requested = options.get("agents")
    default_agents = workflow["budget"]["default_agents"]
    requested_agents = requested if isinstance(requested, int) else default_agents
    if requested_agents < 0:
        raise ValueError("agents must be zero or greater")
    planned_agents = min(requested_agents, workflow["budget"]["max_agents"]) if capabilities.get("subagents") else 0
    native_mode = select_native_mode(workflow, platform, capabilities)
    if not capabilities.get("subagents") and native_mode == "codex-subagents":
        native_mode = "none"
    return {
        "schemaVersion": 1,
        "workflow": workflow["id"],
        "description": workflow["description"],
        "target": str(target),
        "platform": platform,
        "dryRun": options.get("dryRun", True),
        "nativeMode": native_mode,
        "budget": {
            "mode": workflow["mode"]["default"],
            "defaultAgents": default_agents,
            "maxAgents": workflow["budget"]["max_agents"],
            "requestedAgents": requested_agents,
            "plannedAgents": planned_agents,
            "maxTokens": workflow["budget"].get("max_tokens"),
            "maxMinutes": workflow["budget"].get("max_minutes"),
            "confirmationRequired": bool(workflow["budget"].get("confirmation_required")),
            "confirmationProvided": bool(options.get("confirmation")),
        },
        "phases": expand_phases(workflow, options.get("conditions") or []),
        "gates": [{"id": gate, "status": "pending"} for gate in workflow["gates"]],
        "resume": workflow.get("resume"),
        "runId": create_run_id(workflow["id"], target, stable=not options.get("persist")),
    }

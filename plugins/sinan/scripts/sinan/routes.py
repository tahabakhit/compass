from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

import yaml

from . import ROOT
from .schemas import assert_valid


def normalize_prompt(prompt: str) -> str:
    return str(prompt or "").lower().replace("“", '"').replace("”", '"').replace("‘", "'").replace("’", "'").strip()


def default_input(prompt: str) -> dict[str, Any]:
    return {
        "prompt": prompt,
        "cwd": str(Path.cwd()),
        "projectType": [],
        "git": {"branch": "", "dirty": False, "summary": ""},
        "workflowState": {},
        "platform": "codex",
        "nativeCapabilities": {
            "planMode": True,
            "subagents": True,
            "dynamicWorkflows": False,
            "hooks": True,
            "mcp": True,
        },
    }


def default_capabilities(platform: str) -> dict[str, bool]:
    return {
        "planMode": True,
        "subagents": True,
        "dynamicWorkflows": platform == "claude",
        "hooks": True,
        "mcp": True,
    }


def phrase_matches(normalized_prompt: str, phrase: str) -> bool:
    normalized_phrase = normalize_prompt(phrase)
    pattern = r"(?<![a-z0-9])" + re.escape(normalized_phrase) + r"(?![a-z0-9])"
    return re.search(pattern, normalized_prompt) is not None


def load_rules() -> list[dict[str, Any]]:
    source_path = ROOT / "routes" / "rules.yaml"
    runtime_path = ROOT / "runtime" / "routes" / "rules.json"
    if source_path.exists():
        data = yaml.safe_load(source_path.read_text(encoding="utf8"))
    else:
        data = json.loads(runtime_path.read_text(encoding="utf8"))
    return sorted(data["rules"], key=lambda rule: (-rule["priority"], rule["id"]))


def prompt_matches(rule: dict[str, Any], prompt: str) -> bool:
    normalized = normalize_prompt(prompt)
    match = rule.get("match", {})
    if any(phrase_matches(normalized, needle) for needle in match.get("anyPromptIncludes") or []):
        return True
    return any(re.search(pattern, normalized) is not None for pattern in match.get("anyPromptMatches") or [])


def apply_native_capabilities(route: dict[str, Any], input_data: dict[str, Any]) -> dict[str, Any]:
    next_route = json.loads(json.dumps(route))
    platform = input_data.get("platform", "codex")
    raw_caps = input_data.get("nativeCapabilities") or {}
    if platform != "codex" and raw_caps == default_capabilities("codex"):
        raw_caps = {}
    caps = {**default_capabilities(platform), **raw_caps}
    native = next_route.get("nativeMode")
    if platform == "claude":
        if next_route.get("workflow") == "research-audit" and caps.get("dynamicWorkflows"):
            native = "claude-dynamic-workflow"
        elif native in {"codex-plan", "claude-plan"} and caps.get("planMode"):
            native = "claude-plan"
        elif native in {"codex-plan", "claude-plan"}:
            native = "none"
    elif native == "codex-plan" and not caps.get("planMode", True):
        native = "none"
    elif native == "codex-subagents" and not caps.get("subagents", True):
        native = "none"
    if not caps.get("subagents", True):
        next_route["agents"] = {"count": 0, "roles": []}
    next_route["nativeMode"] = native
    return next_route


def base_route(**overrides: Any) -> dict[str, Any]:
    route = {
        "taskSize": "light",
        "intent": "research",
        "workflow": None,
        "nativeMode": "none",
        "skills": [],
        "agents": {"count": 0, "roles": []},
        "hooks": [],
        "budget": "small",
        "reason": "Cheap deterministic route.",
    }
    route.update(overrides)
    return route


MICRO_PATTERN = r"\b(run `date`|show git status|what is in `package.json`|summarize this paragraph|translate this|make this sentence clearer|what does this file do)\b"
BOOTSTRAP_PATTERN = r"\b(bootstrap|start this repo|new repo|empty repo|resume from handoff|previous handoff|continuation notes)\b"
INIT_TARGET_PATTERN = r"\b(init|initialize|initialise)\b.{0,50}\b(repo|repository|workspace|project)\b|\b(repo|repository|workspace|project)\b.{0,50}\b(init|initialize|initialise)\b"
SCAFFOLD_PATTERN = r"\b(setup|set up|set this up|set this project up|need to set this up|can you set this up|scaffold|doctor|instructions|agent conventions?|agent policy|repo-local agent policy)\b"


def fallback_route(input_data: dict[str, Any]) -> dict[str, Any]:
    prompt = normalize_prompt(input_data["prompt"])
    platform = input_data.get("platform", "codex")
    plan = "claude-plan" if platform == "claude" else "codex-plan"
    if re.search(MICRO_PATTERN, prompt):
        return base_route(taskSize="micro", reason="Simple read or language task; no Sinan overhead.")
    if re.search(BOOTSTRAP_PATTERN, prompt) or re.search(INIT_TARGET_PATTERN, prompt):
        return base_route(taskSize="full", intent="setup", workflow="bootstrap", nativeMode=plan, skills=["bootstrap"], hooks=["bash-guard"], budget="medium", reason="Bootstrap should inspect repo state and handoffs before choosing startup steps.")
    if re.search(r"\b(brainstorm|think through|shape this idea|product direction|ambiguous|acceptance criteria)\b", prompt):
        return base_route(taskSize="full", intent="clarify", workflow="clarify", nativeMode=plan, skills=["brainstorm"], hooks=["bash-guard"], reason="Ambiguous work should be shaped before decisions or implementation.")
    if re.search(r"\b(decision capture|capture decisions|glossary\.md|adr|architecture decision)\b", prompt):
        return base_route(taskSize="full", intent="clarify", workflow="clarify", nativeMode=plan, skills=["decision-capture"], hooks=["bash-guard"], reason="Durable project memory should be confirmed before writing.")
    if re.search(r"\b(architecture before implementation|plan the architecture|choose the architecture|system shape|module boundaries|data shape)\b", prompt):
        return base_route(taskSize="full", intent="architecture", workflow="architecture-sweep", nativeMode=plan, skills=["zoom-out", "architecture"], agents={"count": 1, "roles": ["review"]}, hooks=["bash-guard"], budget="medium", reason="Architecture should choose boundaries before starter or implementation work.")
    if re.search(r"\b(review|audit (this )?(pr|diff)|pr feedback|code review)\b", prompt):
        return base_route(taskSize="full", intent="review", workflow="review", nativeMode=plan, skills=["review"], agents={"count": 1, "roles": ["review"]}, hooks=["bash-guard"], budget="medium", reason="Review work needs evidence-backed findings.")
    if re.search(r"\b(failing test|broken|regression|debug|diagnose|fix this failing test)\b", prompt):
        return base_route(taskSize="full", intent="debug", workflow="debug", nativeMode=plan, skills=["diagnose"], hooks=["bash-guard"], budget="medium", reason="Debugging benefits from reproduce-minimize-fix verification.")
    if re.search(r"\b(implement|build|add feature|add oauth login)\b", prompt):
        return base_route(taskSize="full", intent="implement", workflow="implement", nativeMode=plan, skills=["tdd"], agents={"count": 1, "roles": ["review"]}, hooks=["bash-guard"], budget="medium", reason="Risky multi-file implementation needs plan and tests.")
    if re.search(r"\b(simplify|system map|deepening|architecture sweep|architecture review|architecture refactor|architecture cleanup|architecture work)\b", prompt):
        skills = ["zoom-out", "architecture-deepening"] if "deepening" in prompt else ["zoom-out", "architecture"]
        return base_route(taskSize="full", intent="architecture", workflow="architecture-sweep", nativeMode=plan, skills=skills, agents={"count": 1, "roles": ["review"]}, hooks=["bash-guard"], budget="medium", reason="Architecture work benefits from system mapping.")
    if re.search(SCAFFOLD_PATTERN, prompt):
        return base_route(taskSize="full", intent="setup", workflow="scaffold", nativeMode=plan, skills=["scaffold"], hooks=["bash-guard"], budget="small", reason="Scaffold should audit repo-local agent policy.")
    if re.search(r"\b(starter|generate starter|initial app)\b", prompt):
        return base_route(taskSize="full", intent="setup", workflow="starter", nativeMode=plan, skills=["starter"], hooks=["bash-guard"], budget="medium", reason="Starter generation should follow confirmed decisions.")
    if re.search(r"\b(add this to wiki|capture this knowledge|save this to wiki|remember this)\b", prompt):
        return base_route(reason="Knowledge capture should draft or route to Zhi when available.")
    if re.search(r"\b(research audit|audit this (orchestration plugin|plugin|system|project)|design v2|research|compare)\b", prompt):
        return base_route(taskSize="workflow", workflow="research-audit", nativeMode=plan, skills=["zoom-out"], agents={"count": 3, "roles": ["research", "review", "compatibility"]}, hooks=["bash-guard"], budget="large", reason="Broad source-backed work earns workflow and bounded lanes.")
    return base_route(taskSize="micro", reason="Simple read or language task; no Sinan overhead.")


def route(input_value: str | dict[str, Any], validate: bool = True) -> dict[str, Any]:
    input_data = default_input(input_value) if isinstance(input_value, str) else input_value
    prompt = input_data.get("prompt", "")
    selected = None
    for rule in load_rules():
        if prompt_matches(rule, prompt):
            selected = dict(rule["route"])
            break
    route_result = fallback_route(input_data) if selected is None else selected
    result = apply_native_capabilities(route_result, input_data)
    if validate:
        validate_route_output(result)
    return result


def validate_route_output(result: dict[str, Any]) -> None:
    schema_path = ROOT / "schemas" / "route-output.schema.json"
    if schema_path.exists():
        assert_valid("https://sinan.local/schemas/route-output.schema.json", result, "route output")
        return
    required = ["taskSize", "intent", "workflow", "nativeMode", "skills", "agents", "hooks", "budget", "reason"]
    missing = [key for key in required if key not in result]
    if missing:
        raise AssertionError(f"route output missing required keys: {', '.join(missing)}")
    if result["taskSize"] not in {"micro", "light", "full", "workflow"}:
        raise AssertionError(f"invalid taskSize: {result['taskSize']}")
    if result["nativeMode"] not in {"codex-plan", "codex-subagents", "claude-plan", "claude-dynamic-workflow", "none"}:
        raise AssertionError(f"invalid nativeMode: {result['nativeMode']}")
    if result["budget"] not in {"small", "medium", "large"}:
        raise AssertionError(f"invalid budget: {result['budget']}")
    if result["taskSize"] == "micro" and (result["workflow"] is not None or result["nativeMode"] != "none" or result["agents"]["count"] != 0):
        raise AssertionError("micro routes must not allocate workflow, native mode, or agents")

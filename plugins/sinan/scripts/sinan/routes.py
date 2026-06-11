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


# Broadened setup grammar: verb+object, either order, plus the standalone verbs.
SETUP_VERB = r"(?:init|initiali[sz]e|initiali[sz]ing|bootstrap|set ?up|setting up|scaffold|start|started|starting|create|creating|spin up|stand up|kick off|onboard|get started|getting started)"
SETUP_OBJECT = r"(?:repo|repository|workspace|project|codebase|monorepo)"
SETUP_INTENT_PATTERN = (
    r"\b(?:bootstrap|onboard)\b"
    rf"|\b{SETUP_VERB}\b.{{0,40}}\b{SETUP_OBJECT}\b"
    rf"|\b{SETUP_OBJECT}\b.{{0,40}}\b{SETUP_VERB}\b"
)
BOOTSTRAP_LANGUAGE_PATTERN = r"\b(bootstrap|initiali[sz]e|initiali[sz]ing|init|new repo|empty repo|start(?:ed|ing)?|get(?:ting)? started|spin up|stand up|kick off|onboard|creat(?:e|ing)|resume from handoff|previous handoff|continuation notes)\b"
SCAFFOLD_LANGUAGE_PATTERN = r"\b(agent conventions?|agent policy|repo-local agent policy|agents\.md|claude\.md|agent scaffold|scaffold instructions|set up instructions|instruction surfaces?|agent surfaces?)\b"
STARTER_LANGUAGE_PATTERN = r"\b(app starter|application shell|framework shell|initial app files?|starter files?|generate (?:the )?starter|scaffold the app|create the app|app skeleton)\b"

SETUP_WORKFLOWS = {"bootstrap", "scaffold", "starter"}
NEXT_COMMAND = {
    "bootstrap": ("sinan bootstrap --target .", "inspect"),
    "scaffold": ("sinan scaffold --target .", "scaffold-surfaces"),
    "starter": ("sinan starter --plan --target .", "plan-starter"),
}


def setup_route(workflow: str, platform: str) -> dict[str, Any] | None:
    plan = "claude-plan" if platform == "claude" else "codex-plan"
    if workflow == "bootstrap":
        return base_route(taskSize="full", intent="setup", workflow="bootstrap", nativeMode=plan, skills=["bootstrap"], hooks=["bash-guard"], budget="medium", reason="Bootstrap should inspect repo state and handoffs before choosing startup steps.")
    if workflow == "scaffold":
        return base_route(taskSize="full", intent="setup", workflow="scaffold", nativeMode=plan, skills=["scaffold"], hooks=["bash-guard"], budget="small", reason="Scaffold owns repo-local agent policy surfaces; audit then write.")
    if workflow == "starter":
        return base_route(taskSize="full", intent="setup", workflow="starter", nativeMode=plan, skills=["starter"], hooks=["bash-guard"], budget="medium", reason="Starter generation follows confirmed decisions and an existing scaffold.")
    return None


def detect_setup_workflow(prompt: str, repo_state: dict[str, Any] | None) -> str:
    # Explicit language wins over repo-state inference.
    if re.search(STARTER_LANGUAGE_PATTERN, prompt):
        return "starter"
    if re.search(SCAFFOLD_LANGUAGE_PATTERN, prompt):
        return "scaffold"
    if re.search(BOOTSTRAP_LANGUAGE_PATTERN, prompt):
        return "bootstrap"
    # Generic setup wording: let repo state disambiguate, defaulting to inspect-first.
    state = repo_state or {}
    if state.get("empty") or state.get("foundationOnly"):
        return "bootstrap"
    if state.get("hasApp") and not state.get("hasAgentsDir"):
        return "scaffold"
    return "bootstrap"


def compute_repo_state(input_data: dict[str, Any]) -> dict[str, Any]:
    provided = input_data.get("repoState")
    if isinstance(provided, dict) and provided:
        return provided
    cwd = input_data.get("cwd")
    if not cwd:
        return {}
    try:
        from .detect import quick_state

        return quick_state(Path(cwd))
    except Exception:
        return {}


def refine_setup_route(route_result: dict[str, Any], input_data: dict[str, Any], repo_state: dict[str, Any], rule_matched: bool) -> dict[str, Any]:
    prompt = normalize_prompt(input_data.get("prompt", ""))
    platform = input_data.get("platform", "codex")
    workflow = route_result.get("workflow")
    if workflow in SETUP_WORKFLOWS:
        # An explicit setup route was chosen; correct the sub-workflow by repo state and language.
        target = detect_setup_workflow(prompt, repo_state)
        if target != workflow:
            return setup_route(target, platform) or route_result
        return route_result
    # Not a setup route. Only adopt setup when no explicit rule matched, the fallback produced
    # no workflow (a micro/no-op result), and the broadened grammar fires. This catches reworded
    # setup requests without hijacking any review/implement/debug classification.
    if not rule_matched and route_result.get("workflow") is None and re.search(SETUP_INTENT_PATTERN, prompt):
        target = detect_setup_workflow(prompt, repo_state)
        return setup_route(target, platform) or route_result
    return route_result


def attach_next_command(result: dict[str, Any]) -> dict[str, Any]:
    workflow = result.get("workflow")
    if workflow in NEXT_COMMAND:
        command, action = NEXT_COMMAND[workflow]
        result["nextCommand"] = command
        result["nextAction"] = action
    elif workflow:
        result["nextCommand"] = None
        result["nextAction"] = "run-workflow"
    else:
        result["nextCommand"] = None
        result["nextAction"] = None
    return result


def route(input_value: str | dict[str, Any], validate: bool = True) -> dict[str, Any]:
    input_data = default_input(input_value) if isinstance(input_value, str) else input_value
    prompt = input_data.get("prompt", "")
    selected = None
    for rule in load_rules():
        if prompt_matches(rule, prompt):
            selected = dict(rule["route"])
            break
    rule_matched = selected is not None
    route_result = selected if rule_matched else fallback_route(input_data)
    repo_state = compute_repo_state(input_data)
    route_result = refine_setup_route(route_result, input_data, repo_state, rule_matched)
    result = apply_native_capabilities(route_result, input_data)
    result = attach_next_command(result)
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

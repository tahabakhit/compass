from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

import yaml
from jsonschema import Draft7Validator, RefResolver, exceptions

from . import ROOT

SCHEMA_FILES = [
    "schemas/route-output.schema.json",
    "schemas/route-input.schema.json",
    "schemas/route-metadata.schema.json",
    "schemas/skill-frontmatter.schema.json",
    "schemas/openai-agent-metadata.schema.json",
    "schemas/workflow.schema.json",
    "schemas/hook-profile.schema.json",
    "schemas/generated-instruction-surface.schema.json",
    "schemas/codex-marketplace.schema.json",
    "schemas/observed-usage.schema.json",
]

CONDITION_TOKEN_RE = re.compile(r"^[a-z0-9][a-z0-9_-]*$")
VERIFIED_CHANGE_GATE_OPTIONS = {
    "cleanup": ({"tests-pass"}, {"diff-reviewed"}),
    "debug": ({"tests-pass"}, {"diff-reviewed"}),
    "implement": ({"tests-pass"}, {"diff-reviewed"}),
    "scaffold": ({"generated-surfaces-verified", "generated-markers-present"}, {"diff-reviewed"}),
    "starter": ({"tests-or-run-command-verified"}, {"diff-reviewed"}),
}


def read_json(relative_path: str) -> Any:
    return json.loads((ROOT / relative_path).read_text(encoding="utf8"))


def read_yaml(relative_path: str) -> Any:
    return yaml.safe_load((ROOT / relative_path).read_text(encoding="utf8"))


def schema_store() -> dict[str, Any]:
    store = {}
    for schema_file in SCHEMA_FILES:
        schema = read_json(schema_file)
        schema_id = schema.get("$id")
        if schema_id:
            store[schema_id] = schema
    return store


def assert_valid(schema_id: str, data: Any, label: str) -> None:
    store = schema_store()
    schema = store.get(schema_id)
    if not schema:
        raise ValueError(f"missing schema: {schema_id}")
    try:
        Draft7Validator(schema, resolver=RefResolver.from_schema(schema, store=store)).validate(data)
    except exceptions.ValidationError as error:
        path = ".".join(str(part) for part in error.path)
        location = f" at {path}" if path else ""
        raise AssertionError(f"{label} failed schema validation{location}: {error.message}") from error


def list_files(relative_dir: str, extension: str) -> list[str]:
    directory = ROOT / relative_dir
    return sorted(str(path.relative_to(ROOT)) for path in directory.iterdir() if path.name.endswith(extension))


def assert_workflow_semantics(workflow: dict[str, Any], label: str) -> None:
    if workflow["budget"]["default_agents"] > workflow["budget"]["max_agents"]:
        raise AssertionError(f"{label} has default_agents greater than max_agents")
    if workflow["mode"]["default"] == "large" and workflow["budget"].get("confirmation_required") is not True:
        raise AssertionError(f"{label} is large but does not require confirmation")
    phase_ids = [phase["id"] for phase in workflow["phases"]]
    if len(set(phase_ids)) != len(phase_ids):
        raise AssertionError(f"{label} has duplicate phase ids")
    for phase in workflow["phases"]:
        condition = phase.get("when")
        if condition and not CONDITION_TOKEN_RE.fullmatch(condition):
            raise AssertionError(f"{label} phase {phase['id']} uses a prose condition instead of a token: {condition}")
    required_gate_options = VERIFIED_CHANGE_GATE_OPTIONS.get(workflow["id"])
    if required_gate_options:
        gates = set(workflow["gates"])
        for options in required_gate_options:
            if gates.isdisjoint(options):
                formatted = " or ".join(sorted(options))
                raise AssertionError(f"{label} verified-change contract missing gate: {formatted}")
        if "diff-reviewed" in gates and "review" not in [phase["id"] for phase in workflow["phases"] if not phase.get("when")]:
            raise AssertionError(f"{label} diff-reviewed gate requires an unconditional review phase")


def assert_hook_profile_semantics(profile: dict[str, Any], label: str) -> None:
    if profile.get("profile") != "core":
        return
    expected = [
        ("session-context", "SessionStart", None),
        ("prompt-router", "UserPromptSubmit", None),
        ("bash-guard", "PreToolUse", "Bash"),
        ("stop-handoff", "Stop", None),
    ]
    if len(profile["hooks"]) != len(expected):
        raise AssertionError(f"{label} must contain exactly {len(expected)} core hooks")
    for hook_id, event, matcher in expected:
        hook = next((candidate for candidate in profile["hooks"] if candidate["id"] == hook_id), None)
        if not hook:
            raise AssertionError(f"{label} is missing core hook {hook_id}")
        if hook["event"] != event or hook.get("matcher") != matcher:
            raise AssertionError(f"{label} has wrong event or matcher for {hook_id}")
        if not (ROOT / hook["script"]).exists():
            raise AssertionError(f"{label} script does not exist for {hook_id}: {hook['script']}")


def assert_route_metadata_semantics(metadata: dict[str, Any], label: str) -> None:
    for rule in metadata.get("rules") or []:
        for pattern in rule.get("match", {}).get("anyPromptMatches") or []:
            try:
                re.compile(pattern)
            except re.error as error:
                raise AssertionError(f"{label}/{rule['id']} has invalid anyPromptMatches pattern: {pattern}") from error
    for example in metadata.get("examples") or []:
        expected = example["expected"]
        if example.get("negativeControl") and expected["taskSize"] != "micro":
            raise AssertionError(f"{label}/{example['id']} negative controls must route to micro")
        if expected["taskSize"] == "micro" and expected["agents"]["count"] != 0:
            raise AssertionError(f"{label}/{example['id']} micro route must not allocate agents")


def validate_all() -> list[str]:
    for schema_file in SCHEMA_FILES:
        Draft7Validator.check_schema(read_json(schema_file))
    for route_file in list_files("routes", ".yaml"):
        metadata = read_yaml(route_file)
        assert_valid("https://sinan.local/schemas/route-metadata.schema.json", metadata, route_file)
        assert_route_metadata_semantics(metadata, route_file)
    observed = read_yaml("benchmarks/observed-usage.yaml")
    assert_valid("https://sinan.local/schemas/observed-usage.schema.json", observed, "benchmarks/observed-usage.yaml")
    for workflow_file in list_files("workflows", ".yaml"):
        workflow = read_yaml(workflow_file)
        assert_valid("https://sinan.local/schemas/workflow.schema.json", workflow, workflow_file)
        assert_workflow_semantics(workflow, workflow_file)
        if workflow["id"] != Path(workflow_file).stem:
            raise AssertionError(f"{workflow_file} id must match file name")
    hook_profile = read_yaml("hooks/profile.core.yaml")
    assert_valid("https://sinan.local/schemas/hook-profile.schema.json", hook_profile, "hooks/profile.core.yaml")
    assert_hook_profile_semantics(hook_profile, "hooks/profile.core.yaml")
    return SCHEMA_FILES

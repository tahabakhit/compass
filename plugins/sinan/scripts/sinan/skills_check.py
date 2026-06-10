from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml

from . import ROOT
from .schemas import assert_valid

TARGET_SKILLS = [
    "task-router",
    "bootstrap",
    "brainstorm",
    "decision-capture",
    "diagnose",
    "tdd",
    "review",
    "zoom-out",
    "architecture",
    "architecture-deepening",
    "scaffold",
    "starter",
    "handoff",
    "compress",
]
HEAVY_SKILLS = {
    "bootstrap",
    "brainstorm",
    "decision-capture",
    "diagnose",
    "tdd",
    "review",
    "zoom-out",
    "architecture",
    "architecture-deepening",
    "scaffold",
    "starter",
}
IMPLICIT_SKILLS = {"task-router", "handoff", "compress"}
HISTORICAL_BASELINE = {"skillCount": 50, "fileCount": 101, "bytes": 406500, "estimatedTokens": 101625}


def list_skill_names() -> list[str]:
    return sorted(path.name for path in (ROOT / "skills").iterdir() if path.is_dir())


def parse_skill(relative_path: str) -> dict[str, Any]:
    source = (ROOT / relative_path).read_text(encoding="utf8")
    if not source.startswith("---\n"):
        raise AssertionError(f"{relative_path} must contain YAML frontmatter")
    _, frontmatter, body = source.split("---", 2)
    return {"frontmatter": yaml.safe_load(frontmatter), "body": body.strip()}


def validate_all_skills() -> list[dict[str, Any]]:
    skill_names = list_skill_names()
    if skill_names != sorted(TARGET_SKILLS):
        raise AssertionError(f"reduced skill set expected {sorted(TARGET_SKILLS)}, got {skill_names}")
    loaded = []
    for skill_name in TARGET_SKILLS:
        skill_path = f"skills/{skill_name}/SKILL.md"
        skill = parse_skill(skill_path)
        assert_valid("https://sinan.local/schemas/skill-frontmatter.schema.json", skill["frontmatter"], skill_path)
        if skill["frontmatter"]["name"] != skill_name:
            raise AssertionError(f"{skill_path} frontmatter name must match directory")
        if not skill["body"]:
            raise AssertionError(f"{skill_path} body must not be empty")
        if len(skill["body"].split()) > 500:
            raise AssertionError(f"{skill_path} body must stay compact")
        metadata_path = ROOT / "skills" / skill_name / "agents" / "openai.yaml"
        metadata = yaml.safe_load(metadata_path.read_text(encoding="utf8"))
        assert_valid("https://sinan.local/schemas/openai-agent-metadata.schema.json", metadata, str(metadata_path.relative_to(ROOT)))
        implicit = metadata["routing"]["allow_implicit_invocation"]
        claude_disabled = skill["frontmatter"].get("disable-model-invocation") is True
        if not implicit and not claude_disabled:
            raise AssertionError(f"{skill_path} must set disable-model-invocation: true for explicit-only use")
        if implicit and claude_disabled:
            raise AssertionError(f"{skill_path} must not disable invocation when metadata allows implicit use")
        if skill_name in HEAVY_SKILLS and implicit:
            raise AssertionError(f"{skill_name} is heavy and must be explicit or router-selected")
        if skill_name in IMPLICIT_SKILLS and not implicit:
            raise AssertionError(f"{skill_name} should remain available for lightweight triggers")
        loaded.append({"name": skill_name, "frontmatter": skill["frontmatter"], "openAiMetadata": metadata})
    return loaded


def list_current_surface_files() -> list[dict[str, Any]]:
    files = []
    for skill_name in list_skill_names():
        for child in ["SKILL.md", "agents/openai.yaml"]:
            path = ROOT / "skills" / skill_name / child
            if path.exists():
                files.append({"path": str(path.relative_to(ROOT)), "bytes": path.stat().st_size})
    return files


def compare_footprint() -> dict[str, Any]:
    files = list_current_surface_files()
    skill_count = len([file for file in files if file["path"].endswith("/SKILL.md")])
    bytes_total = sum(file["bytes"] for file in files)
    current = {"source": "skills/", "skillCount": skill_count, "fileCount": len(files), "bytes": bytes_total, "estimatedTokens": (bytes_total + 3) // 4}
    reduction = HISTORICAL_BASELINE["estimatedTokens"] - current["estimatedTokens"]
    return {"baseline": HISTORICAL_BASELINE, "current": current, "reduction": {"estimatedTokens": reduction, "percent": round(reduction / HISTORICAL_BASELINE["estimatedTokens"] * 100, 1)}}


def assert_footprint(result: dict[str, Any]) -> None:
    if result["current"]["skillCount"] != len(TARGET_SKILLS):
        raise AssertionError(f"expected {len(TARGET_SKILLS)} current skills")
    if result["baseline"]["estimatedTokens"] <= result["current"]["estimatedTokens"]:
        raise AssertionError("current skill token footprint must stay below historical baseline")

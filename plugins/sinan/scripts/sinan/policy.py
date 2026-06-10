from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml

from . import ROOT

POLICIES = ROOT / "policies"


@lru_cache(maxsize=None)
def load_policy(name: str) -> dict[str, Any]:
    path = POLICIES / name
    with path.open("r", encoding="utf8") as handle:
        data = yaml.safe_load(handle) or {}
    if not isinstance(data, dict):
        raise ValueError(f"{path} must contain a YAML mapping")
    return data


def repo_types() -> dict[str, Any]:
    return load_policy("repo-types.yml")["repo_types"]


def repo_type_names() -> list[str]:
    return sorted(repo_types().keys())


def layout_rules() -> dict[str, Any]:
    return load_policy("layout-rules.yml")


def bad_patterns() -> list[dict[str, str]]:
    return list(load_policy("bad-patterns.yml")["bad_patterns"])

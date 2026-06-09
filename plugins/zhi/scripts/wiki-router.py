#!/usr/bin/env python3
"""Route local knowledge to the correct LLM Wiki hub."""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path


DEFAULT_REGISTRY = Path.home() / ".config" / "llm-wiki" / "registry.json"

WORK_TERMS = {
    "ptxc",
    "ptxc ia",
    "cam",
    "query cam",
    "semantic-modeling",
    "semantic modeling",
    "semantic model",
    "cam dbt",
    "dbt",
    "routing",
    "data product",
    "openmetadata",
    "snowflake",
}

PERSONAL_TERMS = {
    "codex",
    "claude code",
    "hermes",
    "agent workflow",
    "harness",
    "homelab",
    "personal",
    "llm systems",
    "wiki plugin",
}


def load_registry(path: Path) -> dict:
    if not path.exists():
        raise SystemExit(f"registry not found: {path}")
    try:
        return json.loads(path.read_text())
    except json.JSONDecodeError as exc:
        raise SystemExit(f"invalid registry JSON: {path}: {exc}") from exc


def hub_path(registry: dict, hub: str) -> Path:
    hubs = registry.get("hubs", {})
    if hub not in hubs:
        raise SystemExit(f"unknown hub {hub!r}; known hubs: {', '.join(sorted(hubs))}")
    return Path(os.path.expanduser(hubs[hub]["path"]))


def route_text(text: str) -> tuple[str, dict[str, int]]:
    lowered = text.lower()
    work_score = sum(1 for term in WORK_TERMS if term in lowered)
    personal_score = sum(1 for term in PERSONAL_TERMS if term in lowered)

    if work_score and personal_score:
        return "ask-or-split", {"personal": personal_score, "ptxc-ia": work_score}
    if work_score:
        return "ptxc-ia", {"personal": personal_score, "ptxc-ia": work_score}
    if personal_score:
        return "personal", {"personal": personal_score, "ptxc-ia": work_score}
    return "personal", {"personal": personal_score, "ptxc-ia": work_score}


def status(registry: dict) -> int:
    print(f"default_hub: {registry.get('default_hub')}")
    for name, hub in registry.get("hubs", {}).items():
        path = Path(os.path.expanduser(hub["path"]))
        marker = "ok" if (path / "wikis.json").exists() else "missing"
        print(f"{name}: {path} [{marker}]")
        print(f"  scope: {hub.get('scope', '')}")
        print(f"  description: {hub.get('description', '')}")
    return 0


def run_scaffold(path: Path, topic: str, title: str, description: str) -> int:
    script = path / "scripts" / "wiki-scaffold.py"
    if not script.exists():
        path.mkdir(parents=True, exist_ok=True)
        local_script = Path(__file__).with_name("wiki-scaffold.py")
        if not local_script.exists():
            raise SystemExit(f"missing scaffold helper: {local_script}")
        script = local_script
    command = [
        sys.executable,
        str(script),
        "--topic",
        topic,
        "--title",
        title,
        "--description",
        description,
    ]
    return subprocess.call(command, cwd=path)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--registry", default=str(DEFAULT_REGISTRY))
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("status")

    route = sub.add_parser("route")
    route.add_argument("--text", required=True)

    scaffold_hub = sub.add_parser("scaffold-hub")
    scaffold_hub.add_argument("--path", required=True)
    scaffold_hub.add_argument("--topic", required=True)
    scaffold_hub.add_argument("--title", required=True)
    scaffold_hub.add_argument("--description", required=True)

    scaffold_topic = sub.add_parser("scaffold-topic")
    scaffold_topic.add_argument("--hub", required=True)
    scaffold_topic.add_argument("--topic", required=True)
    scaffold_topic.add_argument("--title", required=True)
    scaffold_topic.add_argument("--description", required=True)

    args = parser.parse_args()
    registry = load_registry(Path(os.path.expanduser(args.registry)))

    if args.command == "status":
        return status(registry)

    if args.command == "route":
        hub, scores = route_text(args.text)
        print(json.dumps({"hub": hub, "scores": scores}, indent=2))
        return 0

    if args.command == "scaffold-hub":
        return run_scaffold(Path(os.path.expanduser(args.path)), args.topic, args.title, args.description)

    if args.command == "scaffold-topic":
        return run_scaffold(hub_path(registry, args.hub), args.topic, args.title, args.description)

    raise SystemExit(f"unknown command: {args.command}")


if __name__ == "__main__":
    raise SystemExit(main())

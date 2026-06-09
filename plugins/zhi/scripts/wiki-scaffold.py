#!/usr/bin/env python3
"""Scaffold the standard nvk-style LLM Wiki hub/topic structure."""

from __future__ import annotations

import argparse
import json
from pathlib import Path


ROOT = Path.cwd()


def write_new(path: Path, text: str) -> bool:
    if path.exists():
        return False
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text)
    return True


def title_from_slug(slug: str) -> str:
    return " ".join(part.capitalize() for part in slug.replace("_", "-").split("-"))


def scaffold(topic: str, title: str, description: str) -> list[str]:
    changed: list[str] = []
    topic_root = ROOT / "topics" / topic

    files = {
        ROOT / "_index.md": f"# LLM Wiki Hub\n\nStatus: active\n\n## Topics\n\n- [{topic}](topics/{topic}/_index.md): {description}\n",
        ROOT / "wikis.json": json.dumps(
            {
                "default": topic,
                "wikis": {
                    "hub": {"path": "<HUB>", "description": "LLM Wiki hub"},
                    topic: {
                        "path": f"topics/{topic}",
                        "title": title,
                        "description": description,
                        "status": "active",
                    },
                },
                "local_wikis": [],
            },
            indent=2,
        )
        + "\n",
        ROOT / "log.md": "# Wiki Activity Log\n\n## scaffold | Initialized LLM Wiki hub\n",
        ROOT / "AGENTS.md": "# AGENTS.md\n\nPurpose: operating guide for this LLM Wiki hub.\n",
        topic_root / "config.md": f"---\ntitle: \"{title}\"\nsummary: \"{description}\"\ntype: config\n---\n\n# {title}\n",
        topic_root / "_index.md": f"# {title} Topic Wiki\n\n## Quick Navigation\n\n- [Raw sources](raw/_index.md)\n- [Compiled articles](wiki/_index.md)\n- [Log](log.md)\n",
        topic_root / "raw" / "_index.md": "# Raw Sources\n\nImmutable source material for this topic.\n",
        topic_root / "wiki" / "_index.md": "# Compiled Articles\n\nSynthesized wiki articles for this topic.\n",
        topic_root / "log.md": "# Wiki Log\n\n## scaffold | Initialized topic wiki\n",
    }

    for directory in [topic_root / "raw", topic_root / "wiki", topic_root / "output"]:
        directory.mkdir(parents=True, exist_ok=True)

    for path, text in files.items():
        if write_new(path, text):
            changed.append(str(path.relative_to(ROOT)))

    return changed


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--topic", default="default")
    parser.add_argument("--title")
    parser.add_argument("--description", default="LLM Wiki topic")
    args = parser.parse_args()

    title = args.title or title_from_slug(args.topic)
    changed = scaffold(args.topic, title, args.description)
    if changed:
        print("created:")
        for path in changed:
            print(f"- {path}")
    else:
        print("wiki scaffold already present; no files changed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

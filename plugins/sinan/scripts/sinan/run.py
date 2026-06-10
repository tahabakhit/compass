#!/usr/bin/env python3
from __future__ import annotations

import sys
from pathlib import Path


def main() -> int:
    plugin_root = Path(__file__).resolve().parents[2]
    root_text = str(plugin_root)
    if root_text not in sys.path:
        sys.path.insert(0, root_text)

    from scripts.sinan.cli import main as cli_main

    return cli_main(sys.argv[1:])


if __name__ == "__main__":
    raise SystemExit(main())

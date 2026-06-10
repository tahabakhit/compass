from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any

from . import ROOT
from .package_check import copy_package


def run(command: list[str], cwd: Path, input_text: str | None = None) -> str:
    return subprocess.check_output(command, cwd=cwd, input=input_text, text=True, stderr=subprocess.STDOUT)


def smoke_hook_runtime(plugin_root: Path) -> None:
    output = run(["node", str(plugin_root / "hooks_src" / "prompt-router.js")], plugin_root, json.dumps({"prompt": "Run `date`."}))
    result = json.loads(output)
    if "taskSize=micro" not in result["hookSpecificOutput"]["additionalContext"]:
        raise AssertionError("installed prompt-router hook did not keep micro prompt lightweight")


def smoke_python_cli(plugin_root: Path) -> None:
    env = dict(os.environ)
    env["PYTHONPATH"] = str(plugin_root)
    bootstrap = subprocess.check_output(
        [sys.executable, "-m", "scripts.sinan.cli", "bootstrap", "--target", str(plugin_root), "--json"],
        cwd=plugin_root,
        env=env,
        text=True,
    )
    if json.loads(bootstrap)["state"] not in {"established", "app-started", "foundation-only"}:
        raise AssertionError("packaged bootstrap did not inspect the plugin root")
    route = subprocess.check_output(
        [sys.executable, "-m", "scripts.sinan.cli", "route", "--prompt", "Add OAuth login.", "--json"],
        cwd=plugin_root,
        env=env,
        text=True,
    )
    if json.loads(route)["workflow"] != "implement":
        raise AssertionError("packaged Python router did not select implement workflow")
    target = Path(tempfile.mkdtemp(prefix="sinan-packaged-target-"))
    try:
        subprocess.check_call(
            [sys.executable, "-m", "scripts.sinan.cli", "scaffold", "--target", str(target), "--repo-type", "library", "--json"],
            cwd=plugin_root,
            env=env,
            stdout=subprocess.DEVNULL,
        )
        for command in [
            ["audit", "--target", str(target), "--repo-type", "library", "--json"],
            ["update", "--target", str(target), "--repo-type", "library", "--json"],
            ["enforce", "--target", str(target), "--repo-type", "library", "--json"],
            ["doctor", "--target", str(target), "--repo-type", "library", "--json"],
            ["sync-instructions", "--target", str(target), "--repo-type", "library", "--check", "--json"],
            ["explain-surfaces", "--target", str(target), "--repo-type", "library", "--json"],
            ["update-research", "--target", str(target), "--json"],
        ]:
            subprocess.check_call([sys.executable, "-m", "scripts.sinan.cli", *command], cwd=plugin_root, env=env, stdout=subprocess.DEVNULL)
    finally:
        import shutil

        shutil.rmtree(target, ignore_errors=True)
    subprocess.check_call([sys.executable, "-m", "scripts.sinan.cli", "test"], cwd=plugin_root, env=env, stdout=subprocess.DEVNULL)
    subprocess.check_call([sys.executable, "-m", "scripts.sinan.cli", "package-check", "--check"], cwd=plugin_root, env=env)


def run_smoke() -> dict[str, Any]:
    with tempfile.TemporaryDirectory(prefix="sinan-python-smoke-") as temp:
        package_root = Path(temp) / "plugins" / "sinan"
        copy_package(package_root, allow_any_target=True)
        smoke_hook_runtime(package_root)
        smoke_python_cli(package_root)
        return {"ok": True, "packageRoot": str(package_root)}

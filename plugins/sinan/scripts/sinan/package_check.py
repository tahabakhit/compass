from __future__ import annotations

import filecmp
import json
import shutil
from pathlib import Path
from typing import Any

from . import ROOT

PACKAGE_PATHS = [
    ".codex-plugin",
    ".claude-plugin",
    "skills",
    "hooks",
    "hooks_src",
    "runtime",
    "scripts/sinan",
    "policies",
    "templates",
]
MAX_PACKAGE_BYTES = 7_500_000
IGNORED_NAMES = {".DS_Store", "__pycache__", ".pyc"}
DEV_ONLY = {"tests", "node_modules", "schemas", "workflows", "routes", "benchmarks", "docs", ".plugin-eval"}
VENDOR_DEV_DIRS = {"tests", "test", "benchmarks"}
PACKAGE_DEV_DIRS = {"benchmarks"}


def ignored(path: Path, relative_path: str = ".") -> bool:
    relative = Path(relative_path)
    parts = relative.parts
    in_vendor = parts[:3] == ("scripts", "sinan", "_vendor")
    return (
        path.name in IGNORED_NAMES
        or path.name.endswith(".pyc")
        or any(part in PACKAGE_DEV_DIRS for part in parts)
        or (in_vendor and any(part in VENDOR_DEV_DIRS for part in parts[3:]))
    )


def walk_files(root: Path, relative_path: str = ".") -> list[str]:
    absolute = root / relative_path
    if not absolute.exists() or ignored(absolute, relative_path):
        return []
    if absolute.is_file():
        return [relative_path]
    files: list[str] = []
    for child in sorted(absolute.iterdir(), key=lambda item: item.name):
        files.extend(walk_files(root, str(Path(relative_path) / child.name) if relative_path != "." else child.name))
    return files


def package_files(root: Path = ROOT) -> list[str]:
    return sorted(file for path in PACKAGE_PATHS for file in walk_files(root, path))


def _bytes(root: Path, files: list[str]) -> int:
    return sum((root / file).stat().st_size for file in files)


def vendor_files(root: Path = ROOT) -> list[str]:
    return [file for file in package_files(root) if file.startswith("scripts/sinan/_vendor/")]


def vendor_binary_files(root: Path = ROOT) -> list[str]:
    binary_suffixes = {".so", ".pyd", ".dll", ".dylib"}
    return [file for file in vendor_files(root) if (root / file).suffix in binary_suffixes]


def package_footprint(root: Path = ROOT) -> dict[str, Any]:
    files = package_files(root)
    vendor = vendor_files(root)
    vendor_binaries = vendor_binary_files(root)
    largest = sorted(({"path": file, "bytes": (root / file).stat().st_size} for file in files), key=lambda item: -item["bytes"])[:10]
    return {
        "packagePaths": PACKAGE_PATHS,
        "fileCount": len(files),
        "bytes": _bytes(root, files),
        "estimatedTokens": (_bytes(root, files) + 3) // 4,
        "vendorBytes": _bytes(root, vendor),
        "vendorFileCount": len(vendor),
        "vendorBinaryBytes": _bytes(root, vendor_binaries),
        "vendorBinaryFileCount": len(vendor_binaries),
        "vendorBinaryFiles": vendor_binaries,
        "maxPackageBytes": MAX_PACKAGE_BYTES,
        "largestFiles": largest,
    }


def assert_package_footprint(result: dict[str, Any]) -> None:
    if result["bytes"] > MAX_PACKAGE_BYTES:
        raise AssertionError(f"package footprint {result['bytes']} bytes exceeds {MAX_PACKAGE_BYTES} byte budget")
    for path in DEV_ONLY:
        if path in PACKAGE_PATHS:
            raise AssertionError(f"package footprint includes dev-only path: {path}")
    required = [
        "scripts/sinan/cli.py",
        "policies/repo-types.yml",
        "templates/agents/README.md.j2",
        "templates/agents/config.yml.j2",
    ]
    files = set(package_files(ROOT))
    for file in files:
        parts = Path(file).parts
        if any(part in PACKAGE_DEV_DIRS for part in parts):
            raise AssertionError(f"package footprint includes dev-only path: {file}")
        if parts[:3] == ("scripts", "sinan", "_vendor") and any(part in VENDOR_DEV_DIRS for part in parts[3:]):
            raise AssertionError(f"package footprint includes vendored dev-only path: {file}")
    for path in required:
        if path not in files:
            raise AssertionError(f"package missing required path: {path}")
    if result["vendorBytes"] < 1_000_000:
        raise AssertionError("vendored Python dependency bundle was not included")


def assert_safe_target(target: Path, allow_any_target: bool = False) -> None:
    resolved = target.resolve()
    if resolved == ROOT:
        raise ValueError("refusing to publish over the source root")
    if resolved == resolved.anchor:
        raise ValueError("refusing to publish to a filesystem root")
    if (resolved / ".git").exists():
        raise ValueError("refusing to publish over a git repository root")
    expected_suffix = Path("agent-marketplaces") / "ming" / "plugins" / "sinan"
    if not allow_any_target and not str(resolved).endswith(str(expected_suffix)):
        raise ValueError(f"refusing to publish outside {expected_suffix}")


def copy_package(target: Path, allow_any_target: bool = True) -> dict[str, Any]:
    assert_safe_target(target, allow_any_target=allow_any_target)
    if target.exists():
        shutil.rmtree(target)
    target.mkdir(parents=True)
    for relative in package_files(ROOT):
        source = ROOT / relative
        destination = target / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)
    return compare_package(target)


def compare_package(target: Path) -> dict[str, Any]:
    source_files = package_files(ROOT)
    target_files = walk_files(target)
    source_set = set(source_files)
    target_set = set(target_files)
    missing = sorted(source_set - target_set)
    extra = sorted(target_set - source_set)
    differing = sorted(
        file
        for file in source_set & target_set
        if not filecmp.cmp(ROOT / file, target / file, shallow=False)
    )
    return {
        "target": str(target.resolve()),
        "packagePaths": PACKAGE_PATHS,
        "sourceFileCount": len(source_files),
        "targetFileCount": len(target_files),
        "missing": missing,
        "differing": differing,
        "extra": extra,
        "changed": sorted([*missing, *differing, *extra]),
    }


def render_text(result: dict[str, Any]) -> str:
    return "\n".join(
        [
            "plugin package footprint",
            f"files: {result['fileCount']}",
            f"bytes: {result['bytes']}",
            f"vendor files: {result['vendorFileCount']}",
            f"vendor bytes: {result['vendorBytes']}",
            f"vendor binary files: {result['vendorBinaryFileCount']}",
            f"vendor binary bytes: {result['vendorBinaryBytes']}",
            f"max bytes: {result['maxPackageBytes']}",
        ]
    )

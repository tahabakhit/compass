from __future__ import annotations

import argparse
import json
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any

from . import ROOT
from . import bootstrap_report, package_check, routes, scaffold, schemas, skills_check, smoke, workflows


def print_json(value: Any) -> None:
    print(json.dumps(value, indent=2))


def add_target(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--target", default=".", help="Target repository or workspace path.")


def command_bootstrap(args: argparse.Namespace) -> int:
    report = bootstrap_report.build_report(args.target)
    if args.persist or args.output:
        report["persisted"] = bootstrap_report.persist_report(report, args.output)
    if args.json:
        print_json(report)
    else:
        print(bootstrap_report.render_text(report))
    return 0


def command_scaffold_like(args: argparse.Namespace, mode: str) -> int:
    include_github = False if getattr(args, "no_github", False) else None
    result = scaffold.run(args.target, mode=mode, repo_type=getattr(args, "repo_type", None), include_github=include_github)
    if getattr(args, "json", False):
        print_json(result)
    else:
        print(scaffold.render_text(result))
    return 0 if result["ok"] else 1


def source_suite_available() -> bool:
    required = [
        ROOT / "schemas" / "route-output.schema.json",
        ROOT / "routes" / "rules.yaml",
        ROOT / "workflows" / "bootstrap.yaml",
        ROOT / "tests" / "sinan",
    ]
    return all(path.exists() for path in required)


def command_packaged_test() -> int:
    footprint = package_check.package_footprint()
    package_check.assert_package_footprint(footprint)
    routed = routes.route("Add OAuth login.")
    if routed["workflow"] != "implement":
        raise AssertionError("packaged route self-test did not select implement workflow")
    skills = sorted(path.name for path in (ROOT / "skills").iterdir() if path.is_dir())
    if skills != sorted(skills_check.TARGET_SKILLS):
        raise AssertionError(f"packaged skills are incomplete: {skills}")
    with tempfile.TemporaryDirectory(prefix="sinan-packaged-test-") as temp:
        target = Path(temp) / "repo"
        target.mkdir()
        scaffold_result = scaffold.run(target, mode="scaffold", repo_type="library", include_github=False)
        if not scaffold_result["ok"] or not (target / ".agents" / "config.yml").exists():
            raise AssertionError("packaged scaffold self-test failed")
        enforce_result = scaffold.run(target, mode="enforce", repo_type="auto", include_github=False)
        if not enforce_result["ok"]:
            raise AssertionError(f"packaged enforce self-test failed: {enforce_result['warnings']}")
    hook_test = ROOT / "tests" / "hooks" / "hook.test.js"
    if hook_test.exists():
        subprocess.check_call(["node", str(hook_test)], cwd=ROOT)
    print("packaged Sinan checks passed")
    return 0


def command_test(args: argparse.Namespace) -> int:
    if not source_suite_available():
        return command_packaged_test()
    schemas.validate_all()
    workflows.validate_all_workflows()
    workflows.build_runtime_data(check=True)
    skills = skills_check.validate_all_skills()
    skills_check.assert_footprint(skills_check.compare_footprint())
    footprint = package_check.package_footprint()
    package_check.assert_package_footprint(footprint)
    subprocess.check_call([sys.executable, "-m", "unittest", "discover", "-s", str(ROOT / "tests" / "sinan")], cwd=ROOT)
    subprocess.check_call(["node", str(ROOT / "tests" / "hooks" / "hook.test.js")], cwd=ROOT)
    print(f"python Sinan checks passed: {len(skills)} skills, {len(workflows.validate_all_workflows())} workflows")
    return 0


def command_package_check(args: argparse.Namespace) -> int:
    result = package_check.package_footprint()
    if args.check:
        package_check.assert_package_footprint(result)
    if args.json:
        print_json(result)
    else:
        print(package_check.render_text(result))
    return 0


def command_route(args: argparse.Namespace) -> int:
    if args.input_json:
        input_data = json.loads(args.input_json)
        if "prompt" not in input_data and args.prompt:
            input_data["prompt"] = args.prompt
        if args.platform:
            input_data["platform"] = args.platform
    else:
        input_data = routes.default_input(args.prompt)
        input_data["platform"] = args.platform or "codex"
    result = routes.route(input_data)
    if args.json:
        print_json(result)
    else:
        skills = ", ".join(result["skills"]) if result["skills"] else "none"
        roles = ", ".join(result["agents"]["roles"]) if result["agents"]["roles"] else "none"
        print(
            "Sinan route: "
            f"taskSize={result['taskSize']}; intent={result['intent']}; workflow={result['workflow'] or 'none'}; "
            f"nativeMode={result['nativeMode']}; skills={skills}; agents={result['agents']['count']} ({roles}); "
            f"budget={result['budget']}. Reason: {result['reason']}"
        )
    return 0


def command_smoke(args: argparse.Namespace) -> int:
    result = smoke.run_smoke()
    if args.json:
        print_json(result)
    else:
        print("packaged plugin smoke passed")
    return 0


def command_update_research(args: argparse.Namespace) -> int:
    result = {
        "target": str(Path(args.target).resolve()),
        "ok": True,
        "writesFiles": False,
        "message": "update-research is advisory; use official vendor docs and record changed assumptions in docs/DECISIONS.md.",
    }
    if args.json:
        print_json(result)
    else:
        print(result["message"])
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="python3 -m scripts.sinan.cli")
    sub = parser.add_subparsers(dest="command", required=True)

    bootstrap = sub.add_parser("bootstrap")
    add_target(bootstrap)
    bootstrap.add_argument("--json", action="store_true")
    bootstrap.add_argument("--persist", action="store_true")
    bootstrap.add_argument("--output")
    bootstrap.set_defaults(func=command_bootstrap)

    scaffold_parser = sub.add_parser("scaffold")
    add_target(scaffold_parser)
    scaffold_parser.add_argument("--repo-type", default="auto")
    scaffold_parser.add_argument("--no-github", action="store_true")
    scaffold_parser.add_argument("--json", action="store_true")
    scaffold_parser.set_defaults(func=lambda args: command_scaffold_like(args, "scaffold"))

    for name in ["audit", "update", "enforce"]:
        command = sub.add_parser(name)
        add_target(command)
        command.add_argument("--repo-type", default="auto")
        command.add_argument("--no-github", action="store_true")
        command.add_argument("--json", action="store_true")
        command.set_defaults(func=lambda args, mode=name: command_scaffold_like(args, mode))

    test = sub.add_parser("test")
    test.set_defaults(func=command_test)

    package = sub.add_parser("package-check")
    package.add_argument("--check", action="store_true")
    package.add_argument("--json", action="store_true")
    package.set_defaults(func=command_package_check)

    route_parser = sub.add_parser("route")
    route_parser.add_argument("--prompt")
    route_parser.add_argument("--platform", choices=["codex", "claude"])
    route_parser.add_argument("--input-json")
    route_parser.add_argument("--json", action="store_true")
    route_parser.set_defaults(func=command_route)

    doctor = sub.add_parser("doctor")
    add_target(doctor)
    doctor.add_argument("--repo-type", default="auto")
    doctor.add_argument("--no-github", action="store_true")
    doctor.add_argument("--json", action="store_true")
    doctor.set_defaults(func=lambda args: command_scaffold_like(args, "enforce"))

    sync = sub.add_parser("sync-instructions")
    add_target(sync)
    sync.add_argument("--check", action="store_true")
    sync.add_argument("--repo-type", default="auto")
    sync.add_argument("--no-github", action="store_true")
    sync.add_argument("--json", action="store_true")
    sync.set_defaults(func=lambda args: command_scaffold_like(args, "enforce" if args.check else "update"))

    explain = sub.add_parser("explain-surfaces")
    add_target(explain)
    explain.add_argument("--repo-type", default="auto")
    explain.add_argument("--no-github", action="store_true")
    explain.add_argument("--json", action="store_true")
    explain.set_defaults(func=lambda args: command_scaffold_like(args, "audit"))

    research = sub.add_parser("update-research")
    add_target(research)
    research.add_argument("--json", action="store_true")
    research.set_defaults(func=command_update_research)

    smoke_parser = sub.add_parser("smoke")
    smoke_parser.add_argument("--json", action="store_true")
    smoke_parser.set_defaults(func=command_smoke)

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        return args.func(args)
    except Exception as error:
        print(str(error), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

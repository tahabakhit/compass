# organize Progressive Disclosure

Use this reference for bulky operational variants, examples, and edge-case details that should stay out of always-read skill orientation.

## Manifest Schema

Roots describe detected source roots with short purposes and optional children,
2-3 levels deep. Placement rules contain `glob`, `rule`, `target`, and `reason`.
Supported rules: `colocated`, `sibling-dir`, `root-dir`, and `within-root`.

Dynamic entries use:

```json
{ "path": ".planning/screenshots/", "scope": "session", "cleanup": "empty-on-expire" }
```

Scopes: `session`, `campaign`, `task`, `permanent`. Cleanup strategies:
`empty-on-expire`, `archive-then-delete`, `delete`, `ignore`.

Ask for cleanup policy: `auto`, `prompt`, or `manual` (default `prompt`). Merge
the result into `.claude/harness.json` under `organization` without changing
other keys.

## Audit Report Template

Report the score block first:

```text
=== Project Health: {project_name} ===
Architecture:  {score}%
Hygiene:       {score}%
Bloat:         {score}%
Overall:       {composite}%
```

Then group architecture violations, hygiene findings, bloat findings, and
suggested actions. Show quick wins before large reorganizations. Ask before
moving files or deleting empty directories.

## Cleanup Report

For each dynamic directory, report path, scope, file count, size, strategy, and
action (`Cleaned`, `Would clean`, or `Skipped`). Expiry rules:

- `session`: older than the last session start.
- `campaign`: associated campaign is completed or parked.
- `task`: task ID no longer exists.
- `permanent`: never expires.

Respect cleanup policy: `auto` executes, `prompt` asks, `manual` reports only.

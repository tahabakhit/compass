# Triage Progressive Disclosure

Load this after `/triage` is selected and a GitHub issue or PR needs detailed
report formatting.

## PR Review

Types: `bugfix`, `feature`, `refactor`, `docs`, `infra`.

Checklist: read the full diff, check regressions against closed issues and
recent commits, check conflicts with in-flight PRs, verify the approach, check
cross-platform assumptions, check project conventions, and flag scope creep.

Resolution includes PR number, title, author, type, changed file count,
mergeability, short summary, findings with file:line references, critical and
non-critical issues, and one recommendation: approve, request changes, or close.

All PR actions are external. Show exact comment or review text and get approval
before posting.

## Issue Resolution

Issue plans include type, severity, component, reproducibility, root cause,
affected code with file:line references, proposed fix, impact, workaround,
breaking-change risk, and recommended action.

Recommended actions: fix next release, needs more info, will not fix with
reason, or duplicate.

## Report And Labels

Triage summary table columns: number, title, type, severity, action, status.

Labels:

- Type: `bug`, `feature`, `question`, `docs`, `infra`
- Severity: `critical`, `high`, `medium`, `low`
- Status: `needs-info`, `confirmed`, `wont-fix`, `duplicate`

Auto-fix PR handoff includes PR number, URL, and `/pr-watch <N>` as the local
watch command.

## Anti-Patterns And gh Notes

Do not post generic comments, propose fixes without reading code, label without
investigating, auto-fix unclear root causes, close without explanation, or guess
without verification.

On Windows, `$GH` is `"/c/Program Files/GitHub CLI/gh.exe"`; elsewhere it is
`gh`. Always pass `--repo <owner/repo>`. Use `$GH issue comment` for comments
and `$GH issue edit --add-label` for labels.

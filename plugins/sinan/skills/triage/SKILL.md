---
name: triage
description: >-
  Use when gitHub issue and PR investigator. Pulls open issues/PRs, classifies
  them, searches the codebase for root cause or reviews contributed code,
  proposes fixes with file:line references, and optionally implements fixes.
  Use for investigating GitHub issues and reviewing PRs; do NOT use for
  general code review unrelated to GitHub issues.
user-invocable: true
---
# Triage — GitHub Issue & PR Investigator

## When to Use

**Don't use when:** fixing a specific already-diagnosed issue (use /marshal); monitoring a single PR's CI (use /pr-watch); reviewing code quality outside of GitHub issues (use /review).

- `/triage` — triage all open, unlabeled issues
- `/triage 10` — investigate issue #10 specifically
- `/triage pr 13` — review PR #13
- `/triage prs` — review all open PRs
- `/triage --batch` — pull all open issues, classify, investigate, report
- `/triage --stale` — find issues older than 14 days with no activity
- After the `issue-monitor` SessionStart hook reports new issues

## Codex PR review integration

For Codex-visible PRs, decide whether to use native `@codex review`, local Sinan triage, or both:

```bash
node scripts/codex-pr-review.js plan --repo <owner/repo> --pr <number> --risk <low|medium|high|local-only> --write
```

Use native `@codex review` when the diff is GitHub-visible and the main need is a focused P0/P1 review. Use local Sinan triage when the answer depends on unpushed files, local generated artifacts, or hands-on edits. Use both for large or risky PRs.

After Codex posts a GitHub review, fetch and ingest the review comments before deciding merge readiness:

```bash
node scripts/codex-review-fetch.js --repo <owner/repo> --pr <number> --write
```

Use `--file <review-comments.json>` with the same script when working from exported/offline review data.

Treat ingested P0/P1 findings as blockers until local verification confirms they are fixed or not applicable.

## Inputs

| Input | Source | Required |
|-------|--------|----------|
| Issue/PR number | Argument (e.g., `/triage 10`, `/triage pr 13`) | No — omit to triage all open |
| Mode | `pr` prefix for PRs | No — defaults to issues |
| Repo | Auto-detected from git remote | Yes (auto) |
| gh CLI | `"/c/Program Files/GitHub CLI/gh.exe"` on Windows, `gh` elsewhere | Yes (auto) |

## Execution Protocol

### Phase 0 — Environment Setup

1. Detect repo from `git remote get-url origin`, extract `owner/repo`
2. Verify `gh` auth status
3. Set `$GH`: Windows → `"/c/Program Files/GitHub CLI/gh.exe"`, other → `gh`

### Phase 1 — Issue Intake

**Single issue** (`/triage 10`):
```
$GH issue view <number> --repo <owner/repo> --json number,title,body,labels,state,comments,createdAt,updatedAt,author,assignees
```

**Batch** (`/triage` or `--batch`):
```
$GH issue list --repo <owner/repo> --state open --json number,title,labels,createdAt,updatedAt --limit 50
```
Filter to untriaged: issues with no labels, or missing priority/type label.

**Stale** (`--stale`):
```
$GH issue list --repo <owner/repo> --state open --json number,title,labels,createdAt,updatedAt --limit 100
```
Filter to issues with no activity in 14+ days.

**Single PR** (`/triage pr 13`):
```
$GH pr view <number> --repo <owner/repo> --json number,title,body,author,state,files,commits,comments,createdAt,headRefName,baseRefName,mergeable,reviewDecision
$GH pr diff <number> --repo <owner/repo>
```

**All PRs** (`/triage prs`):
```
$GH pr list --repo <owner/repo> --state open --json number,title,author,createdAt,labels --limit 50
```

### Phase 1b — PR Review Protocol

Load [progressive disclosure](references/progressive-disclosure.md) for PR
classification, checklist, resolution template, and external action rules.

### Phase 2 — Classification

**Type** (exactly one):
| Type | Signal |
|------|--------|
| `bug` | Error messages, "doesn't work", stack traces, regression |
| `feature` | "Would be nice", "add support for" |
| `question` | "How do I", "is it possible" |
| `docs` | README/documentation issues |
| `infra` | CI/CD, build, packaging, dependencies |

**Severity** (bugs only):
| Severity | Criteria |
|----------|----------|
| `critical` | Blocks installation or core functionality for all users |
| `high` | Breaks a major feature or affects many users |
| `medium` | Breaks a minor feature or has a workaround |
| `low` | Cosmetic, edge case, or easy workaround |

**Affected Component:**
- Sinan hooks / skills / agents
- `.claude/harness.json` — project configuration
- `.planning/` — planning/campaign system
- `docs/` — documentation
- Root files — project setup

### Phase 3 — Investigation

#### 3a. Parse the Report

Extract: error messages, environment, reproduction steps, expected vs actual behavior, workarounds.

#### 3b. Search the Codebase

1. Grep for exact error messages / error codes
2. Read files named in the issue
3. Find functions named in stack traces
4. Search for the bug class or anti-pattern
5. `git log --oneline -20 -- <affected-files>` for recent changes
6. Cross-reference similar issues

#### 3c. Root Cause Analysis

For bugs:
1. What breaks — the specific code path
2. Why it breaks — root cause, not symptom
3. When introduced — git blame / log
4. Who is affected — scope
5. The fix — file:line references

For features/questions:
1. Already possible? Search existing functionality.
2. Where would it go? Which component/layer.
3. Effort: trivial / small / medium / large
4. Blockers: dependencies, architecture constraints

#### 3d. Reproduce (when possible)

Set up conditions, run the failing command, confirm error matches, verify proposed fix resolves it.

### Phase 4 — Resolution Plan

Load [progressive disclosure](references/progressive-disclosure.md) for the
issue resolution template. The plan must include root cause, affected code,
specific fix, impact, and recommended action.

### Phase 5 — Action

**Auto-fix** when: root cause clear and verified, fix contained to 1-3 files, no breaking changes, no architectural decisions needed.

Steps:
1. Branch: `fix/issue-<number>-<slug>`
2. Implement fix
3. Run typecheck/build
4. Commit: `fix: <description> (closes #<number>)`
5. Push and open PR linking the issue
6. Comment on the issue with the PR link

**Comment with findings** when fix needs discussion or user input: post root cause analysis, proposed fix, and questions.

**Label only** for questions/docs/features: add type + priority labels, optionally point to existing docs.

### Phase 6 — Report

Load [progressive disclosure](references/progressive-disclosure.md) for the
triage summary table, label taxonomy, and auto-fix PR handoff.

## Contextual Gates

**Disclosure:** "Triaging GitHub issues and PRs. Read-only — no changes made without showing you first."
**Reversibility:** green — investigation is read-only; any GitHub actions (labels, comments, PRs) shown to user for approval before posting
**Trust gates:**
- Any: view triage report and decide the next operator action

## Quality Gates

- [ ] Every issue has a classification (type + severity for bugs)
- [ ] Every bug has root cause with file:line references
- [ ] Every auto-fix passes typecheck and build
- [ ] Every PR links to the issue it fixes
- [ ] Every issue has at least a label or comment
- [ ] No issue comment is generic or substanceless

## Fringe Cases

**gh not available or not authenticated:** Stop and instruct: "Run `gh auth login` before using /triage."

**No open issues or PRs:** Report "No open issues found." and exit cleanly.

**Empty/unparseable issue body:** Classify as `needs-info`, comment requesting reproduction steps.

**`.planning/` missing:** /triage reads from GitHub, not local state. Skip .planning/ writes if missing.

## Anti-Patterns And CLI Notes

Load [progressive disclosure](references/progressive-disclosure.md) for the
do-not list and `gh` command notes.

## Exit Protocol

```
---HANDOFF---
- Triaged N issues: X bugs, Y features, Z questions
- Auto-fixed: <list of issue numbers with PR links>
- Needs attention: <list of issues requiring human decision>
- New labels applied: <count>
- Reversibility: green — investigation read-only; auto-fix PRs can be closed/reverted if unwanted
---
```

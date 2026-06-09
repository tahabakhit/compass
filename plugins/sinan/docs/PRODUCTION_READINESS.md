# Sinan Production Readiness

Last verified: 2026-06-09

This report defines the readiness matrix for using Sinan as the default
cross-project Codex and Claude Code harness. "Ready" means every supported
scenario below has fresh local evidence, unsupported or partially verified
scenarios are documented, and routing remains proportional with Sinan as the
only primary router.

## Readiness Matrix

| Area | Supported scenario | Evidence | Status |
|---|---|---|---|
| Dirty state audit | Existing Sinan worktree with broad uncommitted plugin, skill, hook, and Plugin Eval changes | `node scripts/context-snapshot.js --json`; `git status --short`; known issues checked at `.planning/known-issues.md` | Pass |
| Core local tests | Full fast harness suite across hooks, security, runtime contracts, routing, installers, bootstrap, compatibility, dashboard, and worktree readiness | `node scripts/test-all.js` | Pass |
| Hook runtime and integration | Hook install, init, synthetic payload handling, and full PreToolUse/PostToolUse pipeline sequences | `node scripts/verify-hooks.js`; `node scripts/integration-test.js` | Pass: 84/84 and 19/19 |
| Skill contracts | All shipped skills include required frontmatter and structure | `node scripts/skill-lint.js` | Pass: 50 clean, 0 warn, 0 fail |
| Routing preview | Proportional route selection, dirty-worktree boundary, workspace routing, explicit skill routing | `node scripts/test-route-preview.js`; targeted CLI probes | Pass |
| Explicit skill governance | Explicit TDD/completion/review routes are honored before generic direct-command shortcuts; internal `self-consistency-reasoner` remains `user-invocable: false` | `node scripts/test-route-preview.js`; Plugin Eval invocation policy | Pass |
| Primary router governance | Sinan remains the primary router; borrowed workflow ideas are bounded as explicit Sinan skills and repo-local state, not an always-on router | `.codex-plugin/plugin.json`; `docs/SINAN_IDENTITY.md`; Plugin Eval policy reports 0 implicit skills | Pass |
| Plugin Eval | Plugin score, policy-aware budgets, and unit tests | `node plugins/plugin-eval/scripts/plugin-eval.js analyze . --format json`; `node plugins/plugin-eval/tests/plugin-eval.test.js` | Pass: 100/100, grade A, low risk; 28/28 unit tests |
| Static benchmarks | Scenario file validity for supported skills | `node scripts/skill-bench.js` | Pass: 74 valid, 0 invalid, 0 skipped |
| Codex compatibility | Codex native integration helpers, plugin artifact generation, readiness checks | `node scripts/test-codex-native-integrations.js`; `node scripts/codex-install.js --project-root <tmp> --skip-plugin-refresh --json` | Pass |
| Claude Code compatibility | Claude hook generation and runtime compatibility without requiring global CLI marketplace mutation | `node scripts/test-all.js`; `node scripts/claude-install.js --project-root <tmp> --skip-validate --install-hooks --json` | Pass |
| Fresh project install/init | New Git repo receives Codex artifacts, Claude settings, `.planning/`, `.sinan/`, delegate scripts, and plugin root marker | Temp runtime trial: fresh repo | Pass |
| Existing initialized project | Existing `.planning/` content and user hooks are preserved while Sinan artifacts are refreshed | Temp runtime trial: existing repo | Pass |
| Dirty repo safety | Dirty source file is preserved and remains dirty after install/init | Temp runtime trial: dirty repo | Pass |
| Multi-repo workspace | Two sibling Git repos receive isolated Sinan state; workspace parent is untouched; multi-repo request routes to `/workspace` | Temp runtime trial: `workspace/repo-a`, `workspace/repo-b` | Pass |
| Uninit/unharness | Sinan state is exported, `.planning/`, `.sinan/`, and agent context are removed, Sinan hooks are stripped, user hooks preserved, and the plugin root refuses self-removal | `node scripts/test-installers.js`; temp runtime trial: `node scripts/unharness.js <tmp>` | Pass |

## Latest Hardening Slice

The router now checks explicit skill intent before tier-0 generic direct
commands. This closes a governance bug where `use TDD to fix flaky auth tests`
could previously be routed as `npm run test` because the word `tests` matched
the generic verification shortcut first.

`unharness` also refuses to run against the Sinan plugin root after the
package rename to `sinan`. The guard now checks current Sinan root
markers and is covered by the installer test suite, while a normal target
project still exports state, removes Sinan files, strips Sinan hooks, and
preserves user hooks.

Added regression coverage:

```bash
node scripts/test-route-preview.js
node scripts/route-preview.js --json -- "use TDD to fix flaky auth tests"
node scripts/test-installers.js
```

Expected result: selected route is `/tdd`, tier 2, with the dirty-worktree
boundary preserved when the repo is dirty.

## Runtime Trial Summary

Runtime trials were executed in temporary Git repositories under `/tmp` and did
not mutate source files in this repository. The combined trial suite completed
55 checks with 0 failures:

- Fresh repo: Codex install prep, Claude hook install prep, and `init-project`.
- Existing repo: preserved `.planning/intake/keep.md` and an existing user hook.
- Dirty repo: preserved an untracked source file and left Git dirty state intact.
- Multi-repo workspace: initialized sibling repos independently and left the
  parent workspace untouched.
- Unharness: exported research state to `docs/sinan/`, removed Sinan state,
  removed Sinan hooks, and preserved the user hook.

## Known Limits

- Live `claude plugin marketplace add/install` and interactive Codex app "Add to
  Codex" clicks were not mutated during this verification run. Local installers
  and hook generation were verified; final marketplace enablement still depends
  on the user's installed CLI/app and local permission state.
- Live LLM benchmark execution is not part of the static readiness gate. Static
  benchmark definitions pass; live execution remains an optional release gate
  when validating model behavior rather than harness packaging.
- Windows-specific Codex shell checks are guarded in `codex-install.js` and run
  only on Windows. This macOS run verifies the non-Windows path plus the shared
  test fixtures.
- Plugin Eval reports explicit-only aggregate skill cost as large by design;
  those skills are excluded from implicit trigger/invoke budgets, which is the
  intended governance boundary.
- Some internal compatibility names still use Sinan, including `.sinan/`
  project state and the `sinan-state` MCP server. They are retained to avoid
  breaking already-initialized projects and can be migrated separately with a
  compatibility bridge.

## Supported By Default

Sinan is supported as a default harness for:

- Fresh projects with no Sinan state.
- Already-initialized projects with existing `.planning/` and user hooks.
- Dirty Git repositories, as long as generated Sinan artifacts are reviewed
  before commit.
- Multi-repo workspaces where each repository is initialized independently.
- Codex artifact preparation and readiness checks.
- Claude Code hook installation and runtime compatibility checks.
- Explicit-only specialist skills that are invoked directly or routed through
  Sinan, without becoming always-on router budget.

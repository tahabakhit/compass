# improve Progressive Disclosure

Use this reference for bulky operational variants, examples, and edge-case details that should stay out of always-read skill orientation.

## Campaign File Schema

Create `.planning/campaigns/improve-{target}.md` on the first `--n` run.
Frontmatter includes version, id, status, type, target, total loops, completed
loops, current rubric level, estimated cost per loop, and start time. Body
includes campaign title, status, direction, loop history table, and continuation
state with `next_loop`, `last_scorecard_log`, `last_outcome`,
`phase_within_loop`, and `level_up_triggered`.

## Loop Log Template

Write `.planning/improvement-logs/{target}/loop-{n}.md` every loop, even on
abort. Include date, selected axis, outcome, scorecard deltas, attack summary,
verification results, behavioral simulation result, proposed rubric additions,
and two or three sentences of learning. Approach comparisons use:
`APPROACH COMPARISON: {A} vs {B} - winner: {A} because {reason}`.

## Level-Up Protocol

Triggers when no axis improved by more than 0.5 in the last two consecutive
loops, no programmatic cap is active, and at least three loops have completed.

1. Freeze `.planning/rubrics/{target}-level-{n}-final.md` with date, completed
   loops, final scorecard, ceiling axes, and plateaued axes.
2. Write `.planning/rubrics/{target}-proposals.md` with re-anchored axes,
   proposed new axes, and retired axes. Include `decomposition_quality`,
   `scope_appropriateness`, and `verification_depth` if missing.
3. Halt for human approval. In campaign mode set `status: level-up-pending`,
   set `level_up_triggered: true`, and write continuation state that names the
   pending approval.
4. On resume after approval, give evaluators the level-final snapshot and tell
   them prior-level scores are now the floor.

The live rubric is changed only by the human. The loop never self-approves a
level-up.

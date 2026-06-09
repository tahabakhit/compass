# setup Progressive Disclosure

Use this reference for bulky operational variants, examples, and edge-case details that should stay out of always-read skill orientation.

## Optional Integrations

Prompt for GitHub, MCP, both, or skip. GitHub copies
`.planning/_templates/claude-triage.yml` into `.github/workflows/` and
`.planning/_templates/REVIEW.md` into `REVIEW.md`, skipping existing files. MCP
copies `.planning/_templates/.mcp.json` to `.mcp.json`, skipping existing files.

## Live Demo

Pick a real recently changed source file. Ask the user which pain point matters:
repeated context, quality, context loss, scale, or skip. Use `/review` for the
first two, show `.planning/` and campaign state for context loss, and show
`/marshal`, `/archon`, and `/fleet` command paths only as stable command names
for larger work. Execute on real code and show output.

## Full Tour

Walk through code quality (`/review`, `/test-gen`, `/systematic-debugging`),
building (`/scaffold`, `/refactor`, `/create-skill`), research (`/research`,
`/research-fleet`, `/infra-audit`), orchestration (`/marshal` session,
`/archon` campaign, `/fleet` parallel), and observability (`/do next`,
`/dashboard`, `/cost`, `/learn`). End by saying everything can route through
`/do`.

## Reference Card

Print actual counts from detected config. The card should show:

- route: `/do [anything]`
- common starts: review, fix, why, build, test, next, status, continue
- larger work: `/marshal` session, `/archon` campaign, `/fleet` parallel
- guards: protect-files, external-gate, circuit-breaker, quality-gate, telemetry
- next steps: add conventions, list skills, create a skill, run improve

Express mode prints route basics and active guards only.

## Closing Lines

Express: `Done. {N} hooks live, {N} skills registered. Type /do [anything] to start.`

Recommended: `Setup complete. {language}{+ framework} configured. {N} hooks live. {N} skills registered. Type /do [anything] to start.`

Full Tour: `Tour complete. {N} hooks live. {N} skills registered. Trust level: {level}.`

Update: `Configuration updated. {N} hooks reinstalled, {N} skills re-registered. Changes: {list}.`

## Fringe Cases

- If `.citadel/plugin-root.txt` is missing, prompt for the install path and save it.
- If no source files exist, skip the demo and suggest `/review [file]` once code exists.
- If protected writes block `harness.json`, use the authorized Node write path.
- If an existing guidance file lacks a trailing blank line, append one before the harness section.
- If stack detection fails, ask for the primary language.
- On update mode, show the diff and confirm changes; never overwrite silently.
- If `bootstrap-project-guidance.js` is missing, fall back to the manual template.

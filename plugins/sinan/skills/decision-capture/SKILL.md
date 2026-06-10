---
name: decision-capture
description: Use when stable terminology, product decisions, or architecture decisions should be written into durable project memory after brainstorming or planning.
disable-model-invocation: true
---

# Decision Capture

Use this skill when exploration has produced decisions worth preserving.

## Workflow

1. Inspect existing `GLOSSARY.md`, `docs/adr/`, `AGENTS.md`, and nearby docs before proposing writes.
2. Separate vocabulary from decisions: terms go in `GLOSSARY.md`; durable architecture choices go in ADRs.
3. Confirm the exact terms, definitions, decision titles, status, consequences, and non-goals before writing.
4. Run `node scripts/decision-capture.js --target <repo> --json` with confirmed `--term "Name=Definition"` and `--adr-title`/`--adr-decision` inputs to preview writes.
5. Use `--write` only after confirmation. The script updates `GLOSSARY.md` and writes ADRs under `docs/adr/YYYY-MM-DD-title.md`.
6. Preserve manual text and append or update only the confirmed generated entries.
7. Keep speculative ideas out of durable memory; send unresolved questions back to `$brainstorm`.
8. Verify the resulting docs are concise, linkable, and consistent with repo language.

## Output

End with captured glossary entries, captured ADRs or decision notes, deferred questions, and the next workflow step.

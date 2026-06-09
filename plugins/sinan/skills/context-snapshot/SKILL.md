---
name: context-snapshot
description: >-
  Use when generate or inspect Sinan's repo-local context snapshot: changed
  files, recent commits, cross-session changes, blast radius, and known-issues
  memory.
user-invocable: true
---
# /context-snapshot — Cheap Cross-Session Orientation

## Orientation

**Use when:** starting work after a gap, checking what changed since the last session, or deciding what files need attention before routing into `/marshal`, `/archon`, or `/fleet`.
**Don't use when:** the task already names a tiny exact edit and git state is irrelevant.

## Commands

```bash
node scripts/context-snapshot.js
node scripts/context-snapshot.js --json
node scripts/context-snapshot.js --project-root <path>
```

The generated file is:

```text
.planning/context-snapshot.json
```

Known recurring failures live at:

```text
.planning/known-issues.md
```

## Protocol

1. Run the snapshot script from the target project root.
2. Read `.planning/context-snapshot.json`.
3. Use `changed_files` and `blast_radius` to decide the minimum files to inspect.
4. Read `.planning/known-issues.md` before debugging repeated failures.
5. If the task becomes broad, route through `/do preview <request>` before choosing `/marshal`, `/archon`, or `/fleet`.

## Output

Report only the useful orientation:

```text
Context snapshot:
- Changed files: <count and notable files>
- Cross-session commits: <count>
- Blast radius: <highest-risk refs>
- Known issues: <relevant entries or "none recorded">
```

## Quality Gates

- `.planning/` exists or the snapshot script created it successfully.
- `.planning/context-snapshot.json` exists after the command unless the project is not a git repository.
- `changed_files` includes uncommitted, staged, and untracked files.
- `blast_radius` is capped and does not block orientation on large repositories.
- Relevant `.planning/known-issues.md` entries are read before debugging repeated failures.

## Fringe Cases

**`.planning/` does not exist:** Run `node scripts/context-snapshot.js`; it creates `.planning/`, `.planning/context/`, and `.planning/known-issues.md`. If creation fails, show a setup hint and continue with direct git inspection.

**Not a git repository:** Report that snapshot generation was skipped. Use direct file inspection or run `/setup` if the user wants durable Sinan state.

**Large diff:** Trust the changed file list, but treat `blast_radius` as partial because it is capped by `SINAN_CONTEXT_MAX_FILES`.

**No known issues file:** Treat known issues as empty; the script will create the template on the next successful run.

## Waste Controls

- The script is capped by `SINAN_CONTEXT_MAX_FILES` and `SINAN_CONTEXT_TIMEOUT_MS`.
- It stores generated state under `.planning/`, not in root-level memory files.
- It does not replace `/do`; it feeds `/do` better project facts.

## Exit Protocol

```text
---HANDOFF---
- Snapshot: .planning/context-snapshot.json | skipped: <reason>
- Changed files: <count>
- Highest blast-radius files: <list>
- Known issues checked: yes | no
- Recommended route: <direct | /marshal | /archon | /fleet>
---
```

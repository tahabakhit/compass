---
name: unharness
description: >-
  Use when remove Sinan from a project. Exports valuable state (campaigns,
  postmortems, research, backlog, discoveries) to docs/sinan/ as
  human-readable markdown, then removes all harness files and hooks. The
  archive is detected by /do setup on re-install and offered for restore.
user-invocable: true
---
# /unharness — Remove Sinan from a Project

## Orientation

**Use when:** removing Sinan from a project entirely -- exports state and cleans up hooks before uninstall.
**Don't use when:** pausing campaign work (just stop or use /session-handoff); removing a single skill (delete its directory manually).

## Invocation Forms

```
/unharness               # Export archive, then remove harness
/unharness --export-only # Export to docs/sinan/ without removing anything
```

---

## Protocol

### Step 1: FIND SINAN ROOT

Read `.sinan/plugin-root.txt` to locate the Sinan install.
If missing, use the directory containing this SKILL.md as the fallback.

```bash
cat .sinan/plugin-root.txt 2>/dev/null || echo "fallback"
```

Store as `{sinanRoot}`.

---

### Step 2: RUN UNHARNESS SCRIPT

```bash
node {sinanRoot}/scripts/unharness.js
```

For `--export-only`:

```bash
node {sinanRoot}/scripts/unharness.js --export-only
```

The script:
1. Scans `.planning/` for valuable content (campaigns, postmortems, research, backlog, discoveries)
2. Reads `.sinan/project.md` and `.claude/harness.json` for project metadata
3. Writes `docs/sinan/{category}.md` files with `sinan-archive: true` frontmatter
4. Removes `.planning/`, `.sinan/`, `.claude/agent-context/`
5. Strips Sinan hook entries from `.claude/settings.json` (preserves user hooks)
6. Prints a summary of what was exported and removed

Print the script output verbatim.

---

### Step 3: CLOSING MESSAGE

After the script completes, print:

**If archive was written:**
```
Archive is at docs/sinan/ — commit it, delete it, or leave it.
Run /do setup again anytime to reinstall Sinan.
If you run setup in this project, it will find the archive and offer to restore your history.
```

**If nothing was exported (empty project):**
```
Sinan removed. No history to archive.
Run /do setup again anytime to reinstall.
```

**If --export-only:**
```
Archive written to docs/sinan/. Harness files left in place.
Run /unharness without --export-only to complete the removal.
```

---

## Fringe Cases

**Script not found:**
Report the error and explain the user can run the hook installer manually:
`node /path/to/sinan/scripts/unharness.js`

**No .planning/ directory (harness was installed but never used):**
The script handles this gracefully — it skips the export and proceeds to cleanup.
Nothing special needed.

**docs/sinan/ already exists from a previous unharness:**
The script overwrites with the current timestamp. Prior archives are replaced.
If the user wants to keep prior archives, they should commit `docs/sinan/` to git first.

**User runs unharness on a project that was never set up:**
The script exits cleanly with "Nothing to export." and nothing is deleted that shouldn't be.

---

## Contextual Gates

**Disclosure:** "Removing Sinan from [project]. Exporting state to [path] before deletion. This is irreversible without reinstalling."
**Reversibility:** red — removes hooks, clears .claude/settings.json entries, deletes .planning/. State export is made first, but reinstalling requires /setup.
**Trust gates:**
- Trusted (20+ sessions): irreversible unless reinstalled; exports state first.

## Quality Gates

- Never prompt the user before running — the export is the safety net, not a confirmation dialog
- Always print the script output so the user can see exactly what happened
- If the script errors, surface the error directly — don't swallow it

## Exit Protocol

After the closing message in Step 3, output nothing further. Unharness is a terminal action — no HANDOFF block, no next-step suggestions. The session is now running without hooks.

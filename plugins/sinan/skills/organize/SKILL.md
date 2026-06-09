---
name: organize
description: >-
  Use when three-pass project health scan: architectural compliance (are
  source files in the right layers?), filesystem hygiene (loose files,
  misplaced assets, stale artifacts), and bloat detection (oversized files,
  binaries in git, compressible assets). Reports composite score. Also manages
  enforceable directory manifests and dynamic directory lifecycle.
user-invocable: true
---
# /organize -- Project Organization Health

## Orientation

Operational variants and bulky edge-case detail should live in [progressive disclosure](references/progressive-disclosure.md).

**Use when:** Auditing whether source files are in the right architectural layers, detecting loose files and misplaced assets, or configuring directory manifests and cleanup policies for a project.

**Don't use when:** You want a structural map of code relationships and module dependencies (use `/map`), you're moving logic between modules (use `/refactor`), or you need to execute a single organizational task without a health audit (use `/marshal`).

## Commands

| Command | Behavior |
|---|---|
| `/organize` | Full flow: scan, detect, recommend, configure |
| `/organize --audit` | Check current files against the manifest, report violations |
| `/organize --cleanup` | Run dynamic directory cleanup based on TTL policy |
| `/organize --show` | Display current organization manifest |
| `/organize --unlock` | Set `locked: false` so enforcement is advisory |
| `/organize --lock` | Set `locked: true` so enforcement blocks violations |

## Protocol

### Step 1: CHECK -- Read Existing Configuration

1. Read `.claude/harness.json` and check for an `organization` key
2. **If `organization` exists and user ran bare `/organize`:**
   - Display current convention, root count, placement rule count, dynamic dir count
   - Ask: "Your organization manifest is already configured. Want to **audit** current
     compliance, **adjust** the rules, or **reconfigure** from scratch?"
   - Route based on answer: audit -> Step 6, adjust -> Step 4, reconfigure -> Step 2
3. **If `organization` exists and user ran `--audit`:** Jump to Step 6
4. **If `organization` exists and user ran `--cleanup`:** Jump to Step 7
5. **If no `organization` key:** Continue to Step 2

### Step 2: SCAN -- Three-Pass Project Analysis

Every scan runs all three passes. A user running `/organize` gets the full picture.

**Do NOT use `find` or `Get-ChildItem`** -- use the **Glob tool** and **Bash** (`git ls-files`, `du`, `wc`) for cross-platform compatibility.

---

#### Pass 1: Architectural Compliance

1. Use the **Glob tool** with pattern `**/` to discover directories. Filter out:
   `node_modules`, `.git`, `.planning`, `.sinan`, `.claude`, `dist`, `build`,
   `__pycache__`, `.next`, `target`, `.venv`, `venv`.
   Cap at 200 directories. If too large, scan only top 3 levels.
2. Read `package.json`, `Cargo.toml`, `pyproject.toml`, `go.mod`, or equivalent for stack
3. Read harness.json for `language` and `framework` fields
4. Count files per directory to find the "heavy" areas
5. Check for existing convention signals:
   - `src/components/`, `src/hooks/`, `src/utils/` -> **layer-based**
   - `src/features/auth/`, `src/features/dashboard/` -> **feature-based**
   - `src/auth/components/`, `src/auth/hooks/` -> **hybrid**
   - Flat `src/` with no subdirectories -> **flat**
   - Mixed signals -> **custom** (needs user input)
6. If an organization manifest exists, check each placement rule against current files. Count compliant vs. violating files.

Record findings:
```
Detected: {convention}
Confidence: {high|medium|low}
Roots: [{path, purpose, file_count}]
Signals: [{pattern, evidence, convention_match}]
Anomalies: [{path, issue}]
```

**Scoring:** `architecture_score = compliant_files / total_source_files * 100`.
If no manifest exists, score is based on how consistently the detected convention is followed.

---

#### Pass 2: Filesystem Hygiene

1. **Loose files in project root.** List every file in the project root. Expected root files:
   - Config: `package.json`, `tsconfig*.json`, `*.config.{js,ts,mjs,cjs}`, `.eslintrc*`,
     `.prettierrc*`, `babel.config.*`, `jest.config.*`, `vite.config.*`, `next.config.*`,
     `rollup.config.*`, `webpack.config.*`, `Cargo.toml`, `pyproject.toml`, `go.mod`,
     `Makefile`, `Dockerfile`, `docker-compose*.yml`, `.env*`, `.editorconfig`,
     `.gitignore`, `.gitattributes`, `.npmrc`, `.nvmrc`, `.node-version`, `.tool-versions`
   - Docs: `README*`, `LICENSE*`, `CHANGELOG*`, `CONTRIBUTING*`, `CLAUDE.md`,
     `QUICKSTART*`, `CODE_OF_CONDUCT*`, `SECURITY*`
   - CI/lock: `*.lock`, `package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`,
     `Gemfile.lock`, `.github/`, `.husky/`
   - Plugin/harness: `.claude/`, `.planning/`, `.sinan/`, `hooks/`, `hooks_src/`,
     `skills/`, `agents/`, `scripts/`
   - Any file listed in `.gitignore`

   Everything else in root (images, PDFs, ZIPs, random scripts, stray source files) is a finding.

2. **Images and assets outside designated directories.** Glob for
   `**/*.{png,jpg,jpeg,gif,svg,ico,webp,mp4,mp3,wav,pdf}`. Check if they
   live under a recognized asset directory (`assets/`, `public/`, `static/`,
   `images/`, `img/`, `media/`, `docs/images/`, `src/assets/`). Files outside are findings.

3. **Large files (>1 MB).** Use `git ls-files -z | xargs -0 stat` or equivalent
   to find tracked files over 1 MB. Report each with path and size.

4. **Empty directories.** Glob for directories, check which contain zero files
   (excluding `.gitkeep`). Report as clutter.

5. **Stale files in active directories.** Files in `src/` not modified in 6+ months
   while siblings are active. Report as "potentially stale" -- advisory only.

6. **Duplicate filenames.** Scan for files with identical names in different directories.
   Flag for awareness.

**Scoring:** Start at 100, deduct:
- -2 per loose non-standard file in project root
- -1 per misplaced asset file
- -3 per large file (>1 MB) tracked in git
- -1 per empty directory
- -0.5 per potentially stale file (capped at -10)
- -0.5 per duplicate filename (capped at -5)

Floor at 0. `hygiene_score = max(0, 100 - deductions)`.

---

#### Pass 3: Bloat Detection

1. **Project size vs. source size.**
   - Total tracked size: `git ls-files -z | xargs -0 stat` (sum sizes)
   - Source code size: same but filtered to `.ts`, `.tsx`, `.js`, `.jsx`, `.py`, `.rs`,
     `.go`, `.java`, `.css`, `.scss`, `.html`, `.md`
   - Ratio: `source_bytes / total_bytes`. Healthy = >60%. Below 40% means non-source dominates.

2. **Largest files ranked.** List top 10 largest tracked files with sizes.

3. **Binary files in git.** Glob for:
   `*.{png,jpg,jpeg,gif,ico,webp,mp4,mp3,wav,woff,woff2,ttf,eot,zip,tar,gz,jar,dll,so,dylib,exe,bin,dat,db,sqlite,pdf}`.
   Check if each could be gitignored or moved to Git LFS. Report count and total size.

4. **Accidentally committed directories.** Check if any of these exist as tracked paths:
   `node_modules/`, `dist/`, `build/`, `.next/`, `target/`, `__pycache__/`, `.venv/`,
   `venv/`, `.cache/`, `.parcel-cache/`, `.turbo/`, `coverage/`. Any hit is a critical finding.

5. **Compressible assets.** PNGs over 500 KB, SVGs over 100 KB, any video/audio file.

**Scoring:** Start at 100, deduct:
- If source ratio <60%: -(60 - ratio)
- -5 per accidentally committed build/dependency directory
- -2 per binary file in git that should be gitignored or in LFS
- -1 per compressible asset (PNG >500KB, SVG >100KB)
- -3 per video/audio file tracked in git

Floor at 0. `bloat_score = max(0, 100 - deductions)`.

---

#### Composite Score

```
composite_score = round(
  architecture_score * 0.40 +
  hygiene_score * 0.35 +
  bloat_score * 0.25
)
```

**Always report all four numbers.** Never report just the architecture score.

```
=== Project Health: {project_name} ===

Architecture:  {score}%  -- source file placement, layer boundaries, test colocation
Hygiene:       {score}%  -- loose files, misplaced assets, stale artifacts, empty dirs
Bloat:         {score}%  -- project size ratio, binaries in git, compressible assets
-------------------------------
Overall:       {composite}%
```

Follow scores with the most actionable findings from each pass. Group by severity (critical first, advisory last). Cap at 10 findings per pass; note "and N more" if truncated.

### Step 3: RECOMMEND -- Present Options

Present a tailored recommendation based on confidence level:

**If confidence is HIGH:** Present the detected convention and its roots. Ask: [Accept], [Adjust], or [Show alternatives].

**If confidence is MEDIUM:** Present the detected convention with anomaly count and 2-3 alternatives including reorganization cost (number of files to move). Ask: [1/2/3].

**If confidence is LOW:** Present the four convention options (feature-based, layer-based, hybrid, flat) with a one-line best-for description each, plus [Custom]. Ask: [1/2/3/4/5].

Wait for user response before proceeding.

### Step 4: CONFIGURE -- Write the Organization Manifest

Use [progressive disclosure](references/progressive-disclosure.md) for roots,
placement rules, dynamic directory entries, cleanup policy options, and the
`harness.json` schema. Merge only the `organization` key and set `locked: false`
initially.

### Step 5: VERIFY -- Confirm the Manifest Works

1. Run a full three-pass audit (Step 6 logic) against the current codebase
2. Report all three scores plus composite
3. If composite < 60%: warn with top issues
4. If architecture > 80% but hygiene or bloat < 60%: call out the drag and note quick wins
5. Tell the user about `--lock`, `--audit`, and `--cleanup` commands

### Step 6: AUDIT -- Full Three-Pass Health Check

Run all three passes from Step 2 and output the composite score first. Load the
audit report template in [progressive disclosure](references/progressive-disclosure.md)
when formatting findings. If the user approves quick fixes, move misplaced files
and delete empty directories only. Never auto-delete files with content.

### Step 7: CLEANUP -- Prune Dynamic Directories

Read dynamic entries from the organization manifest, determine expiry by scope,
respect `cleanupPolicy`, and format the report using
[progressive disclosure](references/progressive-disclosure.md).

## Fringe Cases

- **`.planning/` does not exist:** Run `/do setup` first to initialize the harness state directory; then re-run.
- **No directories found:** Skip scan, suggest flat convention.
- **Monorepo detected** (multiple package.json): Scan each package root separately. Ask if organization should be per-package or repo-wide.
- **User changes convention:** Warn about number of files to move. Do NOT auto-move without explicit confirmation.
- **Conflict with existing rules:** If harness.json `protectedFiles` conflict with placement rules, warn and ask which takes precedence.
- **Dynamic dir doesn't exist yet:** Keep the entry in the manifest. Don't warn about missing dynamic dirs.
- **Archive directory grows large:** If `.planning/archive/` exceeds 50MB, warn and suggest manual pruning.

## Contextual Gates

**Disclosure:** "Running project health scan. Phase 3 (cleanup) may move files — will confirm scope before executing."
**Reversibility:** amber — may move files or rename directories in cleanup phase; undo with `git checkout -- .` or `git revert`
**Trust gates:**
- Any: run scan and view report (Phases 1-2)
- Familiar (5+ sessions): Phase 3 file moves execute autonomously; novices should stop after Phase 2 (report only)

## Quality Gates

- [ ] All three passes ran -- never skip a pass
- [ ] All three scores plus composite reported
- [ ] Project directory tree scanned (Step 2 completed or skipped with existing config)
- [ ] User presented with options and made a choice (not auto-decided)
- [ ] Organization manifest written to harness.json under `organization` key
- [ ] Placement rules are specific (glob + rule + reason, no vague entries)
- [ ] Dynamic directory entries have valid scope and cleanup strategy
- [ ] User told about `--lock`, `--audit`, and `--cleanup` commands
- [ ] No other harness.json keys modified during write

## Exit Protocol

```
---HANDOFF---
- Health: {composite}% (Architecture {arch}%, Hygiene {hyg}%, Bloat {bloat}%)
- Convention: {convention} applied to {project}
- {N} roots, {M} placement rules, {K} dynamic directories configured
- Top findings: {1-2 most impactful issues from hygiene/bloat passes}
- Enforcement: {"advisory (unlocked)" | "blocking (locked)"}
- Reversibility: amber — file moves undoable with `git checkout -- .`; harness.json changes undoable with `git revert`
- Next: Run `/organize --lock` when confident, `/organize --audit` to recheck
---
```

---
name: setup
description: >-
  Use when first-run experience for the harness. Three modes: Recommended
  (guided, ~3 min), Full Tour (guided + skill walkthrough, ~8 min), and
  Express (zero questions, ~30 sec). Installs hooks first, detects stack,
  configures harness.json, runs a live demo on real code, and prints a
  reference card.
user-invocable: true
---
# /do setup — First-Run Experience

Configures the harness for a specific project: installs hooks, detects stack, writes harness.json, and optionally demos the system on real code. Flag: `/do setup --express` skips mode selection and runs Express directly.

## Orientation

Operational variants and bulky edge-case detail should live in [progressive disclosure](references/progressive-disclosure.md).

**Use when:** first-run harness configuration on a new project -- installs hooks, generates harness.json, scaffolds .planning/.
**Don't use when:** harness is already configured and you want to verify it (use /verify); adding a single skill to an existing project (copy SKILL.md manually).

## Protocol

### Step -1: ARCHIVE DETECTION (all modes, before anything else)

```bash
ls docs/citadel/ 2>/dev/null
```

If `docs/citadel/` exists and contains `.md` files with `citadel-archive: true` in frontmatter, extract `exported-at` date and prompt once:

```
Found a harness archive from {exported-at date}.
  Campaigns: {N}  Postmortems: {N}  Backlog items: {N}  Research: {N}

Restore history into .planning/ during setup? [Y/n]
```

- **Y or Enter**: set `restoreArchive = true`. Restore after Step 1 (see ARCHIVE RESTORE below).
- **n**: skip silently.

If no archive found, skip entirely — no output.

**ARCHIVE RESTORE** (runs after Step 1 if `restoreArchive = true`):

| File | Restore to |
|---|---|
| `campaigns.md` | Split sections → `.planning/campaigns/completed/{name}.md` |
| `postmortems.md` | Split sections → `.planning/postmortems/{name}.md` |
| `research.md` | Split sections → `.planning/research/{name}.md` |
| `backlog.md` | Split sections → `.planning/intake/{name}.md` |
| `discoveries.md` | Split sections → `.planning/discoveries/{name}.md` |
| `project.md` | Strip frontmatter → `.citadel/project.md` |
| `harness.json.md` | Strip frontmatter → `.claude/harness.json` |

Splitting: each `## Section Title` becomes one restored file. Strip frontmatter before writing.

After restore: `  ✓ Archive restored — {N} campaigns, {N} postmortems, {N} backlog items`

---

### Step 0: MODE SELECTION

```
Welcome.

How would you like to get started?

  [1] Recommended  — auto-detect your stack, install hooks, live demo  (~3 min)
  [2] Full Tour    — everything in Recommended + guided skill walkthrough (~8 min)
  [3] Express      — zero questions, auto-detect, hooks installed, done  (~30 sec)

Press Enter for Recommended, or type 1, 2, or 3.
```

If harness.json already exists with full config, add:
```
  [4] Update — reconfigure existing setup (current: {language}, {skillCount} skills)
```

Default: Recommended. If `--express` flag passed: skip mode selection, run Express.

---

### Step 1: INSTALL HOOKS (all modes, always first)

Hooks must be live before anything else.

```bash
node {citadel-root}/scripts/install-hooks.js
```

Find `{citadel-root}`:
1. Read `.citadel/plugin-root.txt`
2. Fallback: directory containing this SKILL.md

The installer reads `hooks/hooks-template.json`, resolves absolute paths, writes into `.claude/settings.json`, preserves non-harness settings, and is idempotent.

**On success:** `  ✓ {N} hooks installed (protect-files, external-gate, circuit-breaker, quality-gate + more)`

**On failure:** output the error, explain manual install path (`node /path/to/harness/scripts/install-hooks.js`), continue — setup must not abort.

---

### Step 2: STACK DETECTION (all modes)

Auto-detect by scanning the project root. Never ask what can be read.

**Language detection (check in order):**
| File | Language |
|---|---|
| `tsconfig.json` | TypeScript |
| `package.json` (no tsconfig) | JavaScript |
| `requirements.txt` or `pyproject.toml` | Python |
| `go.mod` | Go |
| `Cargo.toml` | Rust |
| `pom.xml` or `build.gradle` | Java |

**Framework detection (read package.json dependencies):**
| Dependency | Framework |
|---|---|
| `next` | Next.js |
| `react` (no next) | React |
| `vue` | Vue |
| `svelte` | Svelte |
| `@angular/core` | Angular |
| `express` | Express |
| `fastify` | Fastify |

**Package manager:**
| File | Manager |
|---|---|
| `pnpm-lock.yaml` | pnpm |
| `yarn.lock` | yarn |
| `bun.lockb` | bun |
| `package-lock.json` | npm |
| `requirements.txt` | pip |
| `Pipfile` | pipenv |

**Test framework:** read `package.json` devDependencies for `jest`, `vitest`, `mocha`, `jasmine`. Python: check `pytest` in requirements.txt or pyproject.toml.

**Typecheck config by language:**
| Language | Command | Per-file |
|---|---|---|
| TypeScript | `npx tsc --noEmit` | yes |
| Python + mypy | `mypy {file}` | yes |
| Python + pyright | `pyright {file}` | yes |
| Go | `go vet ./...` | no |
| Rust | `cargo check` | no |
| JavaScript | (none) | no |

**Confirmation (Recommended + Full Tour only):**
Output: `Detected: {language}{+ framework if any} · {packageManager} · {testFramework if any}`
Then: `Correct? [y/n/edit]`
- `y`/Enter: proceed; `n`/`edit`: ask for corrections inline
- Express: skip confirmation, use detected values

---

### Step 3: GENERATE CONFIG (all modes)

Write `.claude/harness.json` using Node (not Write tool — harness.json is protected after first install):

```javascript
node -e "
const fs = require('fs');
const existing = fs.existsSync('.claude/harness.json')
  ? JSON.parse(fs.readFileSync('.claude/harness.json', 'utf8'))
  : {};

const skillDirs = fs.readdirSync('{citadelRoot}/skills', { withFileTypes: true })
  .filter(d => d.isDirectory()).map(d => d.name);

const config = {
  language: '{detected}',
  framework: '{detected or null}',
  packageManager: '{detected}',
  typecheck: { command: '{command}', perFile: {bool} },
  test: { command: '{testCommand}', framework: '{testFramework}' },
  qualityRules: { builtIn: ['no-confirm-alert', 'no-transition-all'], custom: [] },
  protectedFiles: ['.claude/harness.json', '.claude/settings.json'],
  features: { intakeScanner: true, telemetry: true },
  registeredSkills: skillDirs,
  registeredSkillCount: skillDirs.length,
  agentTimeouts: { skill: 600000, research: 900000, build: 1800000 },
  trust: {
    sessionCount: existing.trust?.sessionCount || 0,
    campaignCount: existing.trust?.campaignCount || 0,
    level: existing.trust?.level || 'novice'
  },
  ...existing  // preserve consent, storage, policy
};
fs.writeFileSync('.claude/harness.json', JSON.stringify(config, null, 2));
"
```

**Skill registry rebuild:** populate `registeredSkills` from every directory under `{citadelRoot}/skills/` plus `.claude/skills/`. Set `registeredSkillCount` to match.

**Dependency pattern suggestions (Recommended + Full Tour only):**
Read `package.json` and check for known libraries:

| If installed | Suggest warning | Message |
|---|---|---|
| `@tanstack/react-query` | raw `fetch(` / `axios` | Use tanstack query instead of raw fetch |
| `zustand` | `React.createContext` | Use Zustand instead of React Context |
| `date-fns` | `new Date().toLocaleDateString` | Use date-fns for date formatting |
| `zod` | `typeof ` / `instanceof ` | Use Zod for runtime validation |

For each match: `"I see {package} installed. Warn agents when they use {anti-pattern}? [y/n]"`
Add accepted patterns to `dependencyPatterns` in harness.json.

---

### Step 4: CLAUDE.md + AGENTS.md (all modes)

```bash
node {citadelRoot}/scripts/bootstrap-project-guidance.js --project-root {projectRoot}
```
Creates `.citadel/project.md` and generates `CLAUDE.md` and `AGENTS.md`. Safe to run — only creates files that don't exist.

**Project description (Recommended + Full Tour only):**
Ask: `"What's this project? One line is fine — or press Enter to use the package name."`
Skip if CLAUDE.md already exists with content.

**CLAUDE.md merge rules:**
- Does not exist → generate starter with detected stack + description
- Exists, no `## Harness` section → append that section at bottom only
- Exists with `## Harness` → skip, don't duplicate
- NEVER overwrite or delete existing content

Starter template:
```markdown
# {Project Name}

{Description}

## Stack
- Language: {detected}
- Framework: {detected}
- Package manager: {detected}
- Test framework: {detected}

## Conventions
(Add your coding conventions, architecture rules, and patterns here.)

## Architecture
(Describe your directory structure and layer boundaries here.)

## Harness

This project uses an agent orchestration harness. Configuration is in
`.claude/harness.json`.
```

---

### Step 5: OPTIONAL INTEGRATIONS (Recommended + Full Tour only)

Load [progressive disclosure](references/progressive-disclosure.md) for optional
GitHub/MCP integration copy steps and prompts.

### Step 6: LIVE DEMO (Recommended + Full Tour only)

Load [progressive disclosure](references/progressive-disclosure.md) for demo
target selection, pain-point prompts, and the demo script.

### Step 7: FULL TOUR WALKTHROUGH (Full Tour only)

Load [progressive disclosure](references/progressive-disclosure.md) for tour
families and exact walkthrough text.

### Step 8: REFERENCE CARD (all modes)

Load [progressive disclosure](references/progressive-disclosure.md) for the
full reference card. Express mode prints only route basics and active guards.

### Step 9: CLOSING LINE (all modes)

Load [progressive disclosure](references/progressive-disclosure.md) for closing
line variants and fringe cases.

---

## Fringe Cases

Load [progressive disclosure](references/progressive-disclosure.md) for missing
`.planning/`, archive restore, no source files, protected `harness.json`, stack
detection failure, update mode, and missing bootstrap script behavior. Setup is
allowed to create `.planning/`; other missing state should be treated as empty
and initialized.

## Contextual Gates

**Disclosure:** "Configuring the harness for this project. Will modify `.claude/settings.json` and install hooks."
**Reversibility:** amber — writes `.claude/settings.json`, installs hooks, creates `.planning/`; undo by running `/unharness`
**Trust gates:**
- Any: first-run configuration; expected to modify settings and install hooks

## Quality Gates

- Hooks must be installed before any other step completes
- harness.json must contain `registeredSkillCount` matching actual skill count
- CLAUDE.md must not lose existing content
- Demo must run on real user code, not a canned example
- Reference card must show accurate skill and hook counts
- Closing line must confirm hooks are live

## Exit Protocol

Do not output a HANDOFF block. Setup is the beginning.
After the closing line, wait for the user's next command.

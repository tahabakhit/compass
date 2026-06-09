# Claude Code Installation Guide

Install Sinan as a Claude Code plugin, verify the marketplace, write project hooks, and run setup from the target repo.

Sources: Claude Code's current plugin docs support marketplace discovery, local paths, GitHub sources, install scopes, and non-interactive `claude plugin marketplace` / `claude plugin install` commands. See [Discover and install plugins](https://code.claude.com/docs/en/discover-plugins), [Create and distribute marketplaces](https://code.claude.com/docs/en/plugin-marketplaces), and [Plugins reference](https://code.claude.com/docs/en/plugins-reference).

## Fast Path: Local Project Install

From the project where you want Sinan enabled:

```bash
git clone https://github.com/SethGammon/sinan.git ~/sinan
cd /path/to/your-project
node ~/sinan/scripts/claude-install.js --install --scope local
claude
```

Then in Claude Code:

```text
/do setup --express
/do --list
/do review path/to/file
```

Local scope is the safest default for trying Sinan: it installs the plugin for you in this repository only and avoids committing project-wide Claude settings.

## What The Installer Does

`scripts/claude-install.js --install --scope local` wraps the manual Claude Code setup:

- validates `.claude-plugin/marketplace.json` and `.claude-plugin/plugin.json`
- runs `claude plugin marketplace add <Sinan> --scope local`
- runs `claude plugin install sinan@sinan-local --scope local`
- runs `scripts/install-hooks.js <project>` so `.claude/settings.json` gets resolved absolute hook paths
- prints the next Claude Code commands to run

Useful variants:

```bash
node ~/sinan/scripts/claude-install.js --dry-run --json
node ~/sinan/scripts/claude-install.js --add-marketplace --scope user
node ~/sinan/scripts/claude-install.js --install-plugin --scope project
node ~/sinan/scripts/install.js --runtime claude --install --scope local
npm run claude:install -- --install --scope local
```

## Manual Install

Inside Claude Code:

```text
/plugin marketplace add /path/to/sinan
/plugin install sinan@sinan-local --scope local
```

Or from the shell:

```bash
claude plugin marketplace add /path/to/sinan --scope local
claude plugin install sinan@sinan-local --scope local
node /path/to/sinan/scripts/install-hooks.js /path/to/your-project
```

For a one-session trial without registering a marketplace:

```bash
cd /path/to/your-project
claude --plugin-dir /path/to/sinan
```

## GitHub Marketplace Install

If you want Claude Code to fetch Sinan from GitHub instead of a local clone:

```bash
claude plugin marketplace add SethGammon/sinan --scope local
claude plugin install sinan@sinan-local --scope local
```

You still need to run `/do setup --express` in the target project so Sinan can detect the stack, initialize state, and refresh hooks.

## Verify

Expected project files after the installer and `/do setup`:

```text
CLAUDE.md
AGENTS.md
.claude/settings.json
.claude/harness.json
.planning/
.citadel/
```

Fast checks:

```bash
claude plugin validate /path/to/sinan
node /path/to/sinan/scripts/test-installers.js
```

In Claude Code:

```text
/do --list
/do review path/to/file
```

## Troubleshooting

### Hooks are not firing

Re-run the installer from the target project:

```bash
node /path/to/sinan/scripts/claude-install.js --install --scope local
```

Or install only hooks:

```bash
node /path/to/sinan/scripts/install-hooks.js /path/to/your-project
```

### Claude says the plugin is not found

Refresh the marketplace and install again:

```bash
claude plugin marketplace update sinan-local
claude plugin install sinan@sinan-local --scope local
```

If the local clone moved, run:

```bash
claude plugin marketplace remove sinan-local
claude plugin marketplace add /new/path/to/sinan --scope local
```

### Setup runs in the wrong project

Start Claude Code from the actual target project root. Setup detects stack files such as `package.json`, `tsconfig.json`, `Cargo.toml`, and similar project markers.

### You want a team-shared install

Use `--scope project` only when you intentionally want Claude Code plugin settings shared through the repository:

```bash
node /path/to/sinan/scripts/claude-install.js --install --scope project
```

Review the settings diff before committing.

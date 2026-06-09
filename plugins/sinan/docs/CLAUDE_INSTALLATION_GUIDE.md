# Claude Code Installation Guide

Install Sinan as a Claude Code plugin, then run setup from the target project.

## Fast Path

Add the Ming marketplace and install Sinan:

```bash
claude plugin marketplace add https://github.com/tahabakhit/ming.git --scope local
claude plugin install sinan@ming --scope local
```

Start a fresh Claude Code session in the target project and run:

```text
/do setup --express
/do --list
/do review path/to/file
```

## What The Plugin Provides

- `.claude-plugin/plugin.json` describes the Claude Code plugin.
- `skills/` provides the installed skill set.
- `hooks/hooks-template.json` provides lifecycle hook definitions.
- `.mcp.json` exposes the local state MCP server.

## Development Checkout

If you are developing Sinan itself, run from `plugins/sinan/`:

```bash
node scripts/install.js --runtime claude --install --scope local
node scripts/claude-install.js --dry-run --json
npm run claude:install -- --install --scope local
```

## Verify

Expected project files after `/do setup`:

```text
CLAUDE.md
AGENTS.md
.claude/settings.json
.claude/harness.json
.planning/
.sinan/
```

Fast checks from a Sinan development checkout:

```bash
claude plugin validate .
node scripts/test-installers.js
npm test
```

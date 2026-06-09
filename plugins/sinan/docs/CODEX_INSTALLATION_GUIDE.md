# Codex Installation Guide

Install Sinan into a project you use with Codex, then verify that Codex can see
the plugin, hooks, skills, MCP state, and project guidance.

## Fast Path

Add the Ming marketplace:

```bash
codex plugin marketplace add https://github.com/tahabakhit/ming.git --ref main
```

Then use `/plugins` or the Codex app plugin UI to install **Sinan**. Start a new
thread in the target project and run:

```text
/do setup --express
```

## What The Plugin Provides

- `.codex-plugin/plugin.json` describes Sinan as a Codex-native harness.
- `skills/` provides the installed skill set.
- `hooks/hooks.json` bundles translated Codex hook commands.
- `.mcp.json` exposes the local state MCP server.
- `.planning/verification/codex-readiness.json` records readiness checks when
  the local installer is used during plugin development.

## Development Checkout

If you are developing Sinan itself, run from `plugins/sinan/`:

```bash
node scripts/install.js --runtime codex --add-marketplace
node scripts/codex-install.js --dry-run
node scripts/codex-install.js --plugin-only
npm run codex:verify
```

## Verify

Expected project files after `/do setup`:

```text
AGENTS.md
.codex/
.planning/
.sinan/
```

Fast checks from a Sinan development checkout:

```bash
node scripts/test-codex-runtime.js
node scripts/test-codex-native-integrations.js
npm test
```

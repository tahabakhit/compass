# Quickstart

From plugin install to your first working `/do` command.

## TL;DR

Easiest path: open your target project in your agent and paste the install
prompt from [INSTALL.md](INSTALL.md).

Manual path:

1. Add the Ming marketplace.

   ```bash
   claude plugin marketplace add https://github.com/tahabakhit/ming.git --scope local
   ```

   ```bash
   codex plugin marketplace add https://github.com/tahabakhit/ming.git --ref main
   ```

2. Install or enable **Sinan** from your runtime's plugin UI.

3. Start a fresh Codex or Claude Code thread, then run:

   ```text
   /do setup --express
   /do next
   /do review src/main.ts
   ```

Both runtimes converge on the same harness commands once Sinan is enabled.
`/do next` is the fastest check that Sinan sees the project state and can
explain the next action and verification profile.

## Prerequisites

- **Claude Code** or **OpenAI Codex** -- the runtime Sinan extends
- **Node.js 18+** -- required for hooks and scripts

Authentication depends on the runtime you use. Sinan layers on top of the
runtime you already have configured.

## Claude Code

```bash
claude plugin marketplace add https://github.com/tahabakhit/ming.git --scope local
claude plugin install sinan@ming --scope local
```

Start a fresh Claude Code session in the target project and run:

```text
/do setup --express
```

## OpenAI Codex

```bash
codex plugin marketplace add https://github.com/tahabakhit/ming.git --ref main
```

Then use `/plugins` or the Codex app plugin UI to install **Sinan**. Start a
fresh Codex session in the target project and run:

```text
/do setup --express
```

## Development Checkout

If you are developing Sinan itself, run the local installer from the plugin
checkout:

```bash
node scripts/install.js --runtime codex --add-marketplace
node scripts/install.js --runtime claude --install --scope local
```

For runtime-specific details, see:

- [docs/CLAUDE_INSTALLATION_GUIDE.md](docs/CLAUDE_INSTALLATION_GUIDE.md)
- [docs/CODEX_INSTALLATION_GUIDE.md](docs/CODEX_INSTALLATION_GUIDE.md)

# Install Sinan

Sinan installs into the project you already have open in Claude Code or OpenAI
Codex.

## Easiest Path: Ask Your Agent

Paste this into the agent running inside your target repository:

```text
Install Sinan in this repository.

Use the Ming marketplace as the source:
https://github.com/tahabakhit/ming.git

Detect whether this session is running in OpenAI Codex or Claude Code, add the
marketplace if needed, install or enable the Sinan plugin, and follow any
printed plugin enable step.

After Sinan is enabled in a fresh thread, run:

/do setup --express

Do not ask me to edit placeholder paths. Use the current repository as the
target project.
```

That prompt is intentionally path-free. The agent should use the installed
plugin and the repository it is already in as the target project.

## Manual Install

Claude Code:

```bash
claude plugin marketplace add https://github.com/tahabakhit/ming.git --scope local
claude plugin install sinan@ming --scope local
```

OpenAI Codex:

```bash
codex plugin marketplace add https://github.com/tahabakhit/ming.git --ref main
```

Then enable Sinan from the plugin UI if prompted, start a fresh Codex or Claude
Code session in the same project, and run:

```text
/do setup --express
```

## Verify

From a Sinan development checkout:

```bash
npm test
```

More detail:

- [Quickstart](QUICKSTART.md)
- [Claude Code installation guide](docs/CLAUDE_INSTALLATION_GUIDE.md)
- [Codex installation guide](docs/CODEX_INSTALLATION_GUIDE.md)

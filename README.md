# Ming

Ming is a local plugin marketplace for Sinan and Zhi.

The name is intentionally short. `ming` maps to `明`: bright, clear,
illumination. It also nods to `faming` (invention), which keeps the
Sinan/Four-Great-Inventions theme without using a long literal marketplace
name.

## Plugins

| Plugin | Runtime roots | Source |
|---|---|---|
| Sinan | Claude Code and Codex | `plugins/sinan` |
| Zhi | Claude Code and Codex | `plugins/zhi/claude-plugin`, `plugins/zhi/plugins/zhi-codex` |

## Install

Claude Code:

```bash
claude plugin marketplace add /Users/taha.bakhit@m10s.io/ming --scope local
claude plugin install sinan@ming --scope local
claude plugin install zhi@ming --scope local
```

Codex:

```bash
codex plugin marketplace add /Users/taha.bakhit@m10s.io/ming
```

Then use `/plugins` or the Codex app plugin UI and install Sinan and Zhi from
the Ming marketplace.

## Notes

- Sinan is the harness/router. Zhi is the paper-inspired knowledge-base
  plugin; its commands remain `/wiki` and `/wiki:*` for compatibility.
- The plugin entries point at real source directories under `ming/plugins/`; no external symlinks are required.

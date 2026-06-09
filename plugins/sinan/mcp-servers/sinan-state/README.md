# sinan-state MCP server

`sinan-state` exposes Sinan planning state to Codex through MCP. It is intentionally read-mostly:

- `sinan_status` summarizes `.planning/`, campaigns, fleet sessions, telemetry, and app artifacts.
- `sinan_workflow_prompt` returns concise prompts for Sinan workflows such as `triage`, `pr-watch`, `daemon`, `schedule`, and `qa`.
- `sinan://status` is a resource view of the same state.

The server lets Codex use Sinan state without scraping terminal output or rereading the whole repository. It is bundled through `.mcp.json` and can also be configured in Codex `config.toml`.

Quick local protocol check:

```bash
printf '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}\n{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}\n' | node mcp-servers/sinan-state/index.js
```

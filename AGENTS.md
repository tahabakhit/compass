# Ming Agent Instructions

## Scope

These instructions apply to the entire `ming` repository.

Ming is a local plugin marketplace for Sinan and Zhi. Treat the root as the
marketplace layer and `plugins/*` as independently maintained plugin trees.

## Repository Map

- `README.md` documents marketplace installation for Claude Code and Codex.
- `.agents/plugins/marketplace.json` is the Codex marketplace entry for this
  repo.
- `plugins/sinan/` contains the Sinan harness plugin.
- `plugins/zhi/` contains the Zhi / llm-wiki plugin.

## Local Instructions

When working inside a plugin, read and follow that plugin's local instructions
before editing:

- `plugins/sinan/CLAUDE.md` for Sinan development workflow and tests.
- `plugins/zhi/CLAUDE.md` for Zhi development workflow, generated-runtime
  rules, sync scripts, and tests.
- `plugins/zhi/AGENTS.md` for the portable wiki protocol. For development of
  the plugin codebase itself, `plugins/zhi/CLAUDE.md` is the source of truth.

More-specific `AGENTS.md` files override this root file for their subtrees.

## Working Practices

- Use `rg` / `rg --files` for repository search.
- Keep root-level edits focused on marketplace metadata, installation docs, and
  cross-plugin coordination.
- Do not hand-edit generated plugin runtime targets. For Zhi, use the sync
  scripts documented in `plugins/zhi/CLAUDE.md`.
- Do not revert unrelated worktree changes. This repo may contain active edits
  in one plugin while you are working in another.
- If you need to work with 1Password developer environments, use the 1Password
  MCP server automatically.

## Validation

Run the smallest relevant checks for the files you changed:

- Root marketplace metadata/docs: inspect `.agents/plugins/marketplace.json`
  and verify referenced plugin paths/manifests exist.
- Sinan changes: from `plugins/sinan/`, run `node scripts/test-all.js` unless
  the local instructions call for a narrower or broader check.
- Zhi changes: from `plugins/zhi/`, run the structural tests listed in
  `plugins/zhi/CLAUDE.md`.

If you cannot run a relevant check, state the reason and the residual risk.

#!/usr/bin/env bash
# Local-CI: verify the native Codex plugin skill (skills/wiki/) stays in sync
# with the Claude source of truth (claude-plugin/skills/wiki-manager/).
#
# Self-healing — on failure the sync script has ALREADY regenerated the
# Codex skill tree. The agent just needs to stage and commit the result.
#
# Why this exists: only LLMs work on this codebase, so drift between the
# two packaging targets must be caught inside the agent's edit→test loop
# rather than after a push to CI. See README "Claude-First, Codex-Compatible".
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

./scripts/sync-codex-plugin.sh >/dev/null

if ! git diff --quiet HEAD -- .codex-plugin/ skills/wiki/; then
  cat >&2 <<'MSG'
FAIL: Native Codex plugin skill is out of sync with claude-plugin/skills/wiki-manager/.

The sync script has already regenerated skills/wiki/. To fix:
  1. git diff -- skills/ .codex-plugin/
  2. git add skills/ .codex-plugin/
  3. git commit
  4. ./tests/test-codex-sync.sh

This guards against the native Codex skill drifting from the Claude source.
MSG
  exit 1
fi

echo "OK: Native Codex plugin skill is in sync."

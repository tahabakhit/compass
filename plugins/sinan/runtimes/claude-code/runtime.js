#!/usr/bin/env node

'use strict';

module.exports = Object.freeze({
  id: 'claude-code',
  displayName: 'Claude Code',
  capabilities: {
    guidance: { support: 'full', notes: 'Uses CLAUDE.md and project hook/config integration.' },
    skills: { support: 'full', notes: 'Canonical Sinan skill flow originated here.' },
    agents: { support: 'full', notes: 'Supports Sinan agent patterns directly.' },
    hooks: { support: 'full', notes: 'Supports the full Sinan lifecycle hook model.' },
    workspace: { support: 'full', notes: 'Standard file and shell workflow available.' },
    worktrees: { support: 'full', notes: 'Fleet worktree model is native to current Sinan design.' },
    approvals: { support: 'partial', notes: 'Approval and consent policies are partly Sinan-managed.' },
    history: { support: 'partial', notes: 'Session persistence exists but campaign files remain Sinan-owned.' },
    telemetry: { support: 'partial', notes: 'Telemetry is primarily Sinan-managed JSONL state.' },
    mcp: { support: 'partial', notes: 'Can integrate with MCP-like services, but not as the primary Sinan surface.' },
    surfaces: { support: 'full', notes: 'Slash-command and plugin-oriented surface is primary.' },
  },
  degradations: [],
});

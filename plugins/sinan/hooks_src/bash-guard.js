#!/usr/bin/env node
"use strict";

const { extractCommand, runHook } = require("./hook-runtime");

const BLOCK_PATTERNS = [
  {
    id: "recursive-force-delete",
    pattern: /\brm\s+(?:-[A-Za-z]*[rf][A-Za-z]*|-[A-Za-z]*r[A-Za-z]*\s+-[A-Za-z]*f[A-Za-z]*|-[A-Za-z]*f[A-Za-z]*\s+-[A-Za-z]*r[A-Za-z]*)\b/,
    reason: "Recursive force delete requires explicit user approval.",
  },
  {
    id: "git-reset-hard",
    pattern: /\bgit\s+reset\s+--hard\b/,
    reason: "Hard resets can discard user work.",
  },
  {
    id: "git-clean-force",
    pattern: /\bgit\s+clean\b(?=[^\n]*(?:-[A-Za-z]*f|--force))/,
    reason: "Forced git clean can delete untracked files.",
  },
  {
    id: "checkout-path-revert",
    pattern: /\bgit\s+checkout\s+--\s+(?:\.|\/|~|[^\s]+)/,
    reason: "Path checkout can revert user changes.",
  },
  {
    id: "filesystem-root-write",
    pattern: /\b(?:rm|mv|cp|chmod|chown)\b[^\n]*(?:\s\/(?:\s|$)|\s\/\*)/,
    reason: "Root-level filesystem mutation is too broad.",
  },
  {
    id: "curl-pipe-shell",
    pattern: /\b(?:curl|wget)\b[^\n|]*\|\s*(?:sh|bash|zsh)\b/,
    reason: "Piping downloaded code into a shell is unsafe.",
  },
  {
    id: "env-secret-echo",
    pattern: /\b(?:echo|printf|cat)\b[^\n]*(?:OPENAI_API_KEY|ANTHROPIC_API_KEY|AWS_SECRET_ACCESS_KEY|GITHUB_TOKEN|NPM_TOKEN|PASSWORD|SECRET|TOKEN)\b/,
    reason: "Command appears to print a secret-bearing value.",
  },
];

const ALLOW_PATTERNS = [
  /\bgit\s+status\b/,
  /\bgit\s+log\b/,
  /\bnpm\s+test\b/,
  /\bnpm\s+run\s+[a-z0-9:-]+\b/,
  /\bpython3?\s+-m\s+scripts\.sinan\.cli\b/,
  /\bpython3?\b[^\n]*scripts\/sinan\/run\.py\b/,
];

function normalizeCommand(command) {
  return String(command || "").trim();
}

function evaluateCommand(command) {
  const normalized = normalizeCommand(command);
  if (!normalized) {
    return {
      action: "continue",
      hook: "bash-guard",
      decision: "allow",
      reason: "No command found.",
    };
  }

  const block = BLOCK_PATTERNS.find((candidate) => candidate.pattern.test(normalized));
  if (block) {
    return {
      action: "block",
      hook: "bash-guard",
      decision: "block",
      rule: block.id,
      reason: block.reason,
      command: normalized,
    };
  }

  const knownSafe = ALLOW_PATTERNS.some((pattern) => pattern.test(normalized));
  return {
    action: "continue",
    hook: "bash-guard",
    decision: "allow",
    reason: knownSafe ? "Known low-risk command." : "No block rule matched.",
    command: normalized,
  };
}

function bashGuard(input = {}) {
  const result = evaluateCommand(extractCommand(input));
  if (result.decision !== "block") return null;

  return {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: `${result.reason} Rule: ${result.rule}.`,
    },
  };
}

if (require.main === module) {
  runHook(bashGuard);
}

module.exports = {
  BLOCK_PATTERNS,
  bashGuard,
  evaluateCommand,
};

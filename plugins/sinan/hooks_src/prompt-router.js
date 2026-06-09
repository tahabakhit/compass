#!/usr/bin/env node
"use strict";

const { extractPrompt, runHook } = require("./hook-runtime");

function normalizePrompt(prompt) {
  return String(prompt || "")
    .toLowerCase()
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .trim();
}

function baseRoute(overrides) {
  return {
    taskSize: "light",
    intent: "research",
    workflow: null,
    nativeMode: "none",
    skills: [],
    agents: { count: 0, roles: [] },
    hooks: [],
    budget: "small",
    reason: "Cheap hook route hint.",
    ...overrides,
  };
}

function routeHintForPrompt(prompt, platform = "codex") {
  const normalized = normalizePrompt(prompt);

  if (
    [
      "run `date`",
      "show git status",
      "what is in `package.json`",
      "summarize this paragraph",
      "translate this",
      "make this sentence clearer",
      "what does this file do",
    ].some((needle) => normalized.includes(needle))
  ) {
    return baseRoute({
      taskSize: "micro",
      reason: "Simple read or language task; no Sinan overhead.",
    });
  }

  if (/\b(review|audit diff|pr feedback|code review)\b/.test(normalized)) {
    return baseRoute({
      taskSize: "full",
      intent: "review",
      workflow: "review",
      nativeMode: platform === "claude" ? "claude-plan" : "codex-plan",
      skills: ["review"],
      agents: { count: 1, roles: ["review"] },
      hooks: ["bash-guard"],
      budget: "medium",
      reason: "Review work needs evidence-backed findings.",
    });
  }

  if (/\b(failing test|broken|regression|debug|diagnose)\b/.test(normalized)) {
    return baseRoute({
      taskSize: "full",
      intent: "debug",
      workflow: "debug",
      nativeMode: platform === "claude" ? "claude-plan" : "codex-plan",
      skills: ["diagnose"],
      hooks: ["bash-guard"],
      budget: "medium",
      reason: "Debugging benefits from reproduce-minimize-fix verification.",
    });
  }

  if (/\b(implement|build|add feature|add oauth login)\b/.test(normalized)) {
    return baseRoute({
      taskSize: "full",
      intent: "implement",
      workflow: "implement",
      nativeMode: platform === "claude" ? "claude-plan" : "codex-plan",
      skills: ["tdd"],
      agents: { count: 1, roles: ["review"] },
      hooks: ["bash-guard"],
      budget: "medium",
      reason: "Risky multi-file implementation needs plan and tests.",
    });
  }

  if (/\b(architecture|simplify|system map|deepening)\b/.test(normalized)) {
    return baseRoute({
      taskSize: "full",
      intent: "architecture",
      workflow: "architecture-sweep",
      nativeMode: platform === "claude" ? "claude-plan" : "codex-plan",
      skills: ["zoom-out", "architecture"],
      agents: { count: 1, roles: ["review"] },
      hooks: ["bash-guard"],
      budget: "medium",
      reason: "Architecture work benefits from system mapping.",
    });
  }

  if (/\b(setup|set up|scaffold|doctor)\b/.test(normalized)) {
    return baseRoute({
      taskSize: "full",
      intent: "setup",
      workflow: "workspace-setup",
      nativeMode: platform === "claude" ? "claude-plan" : "codex-plan",
      hooks: ["bash-guard"],
      reason: "Workspace setup should inspect and propose before writing.",
    });
  }

  if (/\b(audit|research|compare|design)\b/.test(normalized)) {
    return baseRoute({
      taskSize: "workflow",
      workflow: "research-audit",
      nativeMode: platform === "claude" ? "claude-plan" : "codex-plan",
      skills: ["zoom-out"],
      agents: { count: 3, roles: ["research", "review", "compatibility"] },
      hooks: ["bash-guard"],
      budget: "large",
      reason: "Broad source-backed work earns workflow and bounded lanes.",
    });
  }

  if (/\b(handoff|continuation summary|compact handoff)\b/.test(normalized)) {
    return baseRoute({
      intent: "handoff",
      skills: ["handoff"],
      reason: "Focused continuation summary; no workflow needed.",
    });
  }

  return baseRoute({});
}

function promptRouter(input = {}) {
  const prompt = extractPrompt(input);
  if (!prompt) {
    return {
      action: "continue",
      hook: "prompt-router",
      routeHint: null,
      reason: "No prompt found.",
    };
  }

  return {
    action: "continue",
    hook: "prompt-router",
    routeHint: routeHintForPrompt(prompt, input.platform || "codex"),
  };
}

if (require.main === module) {
  runHook(promptRouter);
}

module.exports = {
  promptRouter,
  routeHintForPrompt,
};

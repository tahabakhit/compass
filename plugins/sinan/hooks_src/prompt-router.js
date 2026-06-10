#!/usr/bin/env node
"use strict";

const { additionalContextOutput, extractPrompt, runHook } = require("./hook-runtime");

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

  if (/\b(bootstrap|bootstrap this repo|start this repo|new repo|empty repo|resume from handoff|previous handoff|continuation notes)\b/.test(normalized)) {
    return baseRoute({
      taskSize: "full",
      intent: "setup",
      workflow: "bootstrap",
      nativeMode: platform === "claude" ? "claude-plan" : "codex-plan",
      skills: ["bootstrap"],
      hooks: ["bash-guard"],
      budget: "medium",
      reason: "Bootstrap should inspect repo state and handoffs before choosing startup steps.",
    });
  }

  if (/\b(brainstorm|think through|shape this idea|product direction|ambiguous|acceptance criteria)\b/.test(normalized)) {
    return baseRoute({
      taskSize: "full",
      intent: "clarify",
      workflow: "clarify",
      nativeMode: platform === "claude" ? "claude-plan" : "codex-plan",
      skills: ["brainstorm"],
      hooks: ["bash-guard"],
      reason: "Ambiguous work should be shaped before decisions or implementation.",
    });
  }

  if (/\b(decision capture|capture decisions|glossary\.md|adr|architecture decision)\b/.test(normalized)) {
    return baseRoute({
      taskSize: "full",
      intent: "clarify",
      workflow: "clarify",
      nativeMode: platform === "claude" ? "claude-plan" : "codex-plan",
      skills: ["decision-capture"],
      hooks: ["bash-guard"],
      reason: "Durable project memory should be confirmed before writing.",
    });
  }

  if (/\b(architecture before implementation|plan the architecture|choose the architecture|system shape|module boundaries|data shape)\b/.test(normalized)) {
    return baseRoute({
      taskSize: "full",
      intent: "architecture",
      workflow: "architecture-sweep",
      nativeMode: platform === "claude" ? "claude-plan" : "codex-plan",
      skills: ["zoom-out", "architecture"],
      agents: { count: 1, roles: ["review"] },
      hooks: ["bash-guard"],
      budget: "medium",
      reason: "Architecture should choose boundaries before starter or implementation work.",
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
      skills: normalized.includes("deepening") || normalized.includes("shallow module")
        ? ["zoom-out", "architecture-deepening"]
        : ["zoom-out", "architecture"],
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
      workflow: "scaffold",
      nativeMode: platform === "claude" ? "claude-plan" : "codex-plan",
      skills: ["scaffold"],
      hooks: ["bash-guard"],
      reason: "Agent scaffolding should inspect and propose before writing.",
    });
  }

  if (/\b(starter|app starter|generate starter|initial app files|framework shell|application shell)\b/.test(normalized)) {
    return baseRoute({
      taskSize: "full",
      intent: "setup",
      workflow: "starter",
      nativeMode: platform === "claude" ? "claude-plan" : "codex-plan",
      skills: ["starter"],
      hooks: ["bash-guard"],
      budget: "medium",
      reason: "Starter generation should follow confirmed product and architecture decisions.",
    });
  }

  if (/\b(add this to wiki|capture this knowledge|save this to wiki|save to personal wiki|remember this)\b/.test(normalized)) {
    return baseRoute({
      reason: "Knowledge capture should draft or route to Zhi when available.",
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

function formatRouteHint(routeHint) {
  if (!routeHint) return "";
  const skills = routeHint.skills.length > 0 ? routeHint.skills.join(", ") : "none";
  const roles = routeHint.agents.roles.length > 0 ? routeHint.agents.roles.join(", ") : "none";
  return `Sinan route: taskSize=${routeHint.taskSize}; intent=${routeHint.intent}; workflow=${
    routeHint.workflow || "none"
  }; nativeMode=${routeHint.nativeMode}; skills=${skills}; agents=${routeHint.agents.count} (${roles}); budget=${
    routeHint.budget
  }. Reason: ${routeHint.reason}`;
}

function promptRouter(input = {}) {
  const prompt = extractPrompt(input);
  if (!prompt) return null;

  const routeHint = routeHintForPrompt(prompt, input.platform || "codex");
  return additionalContextOutput("UserPromptSubmit", formatRouteHint(routeHint));
}

if (require.main === module) {
  runHook(promptRouter);
}

module.exports = {
  formatRouteHint,
  promptRouter,
  routeHintForPrompt,
};

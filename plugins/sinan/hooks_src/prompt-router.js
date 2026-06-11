#!/usr/bin/env node
"use strict";

const childProcess = require("node:child_process");
const path = require("node:path");
const { ROOT, additionalContextOutput, extractPrompt, runHook } = require("./hook-runtime");

const RUNNER = path.join(ROOT, "scripts", "sinan", "run.py");

function pythonCommand() {
  return process.env.PYTHON || "python3";
}

function routeHintForPrompt(prompt, platform = "codex") {
  return routeHintForInput({ prompt, platform });
}

function defaultPlatform() {
  return process.env.CLAUDE_PLUGIN_ROOT && !process.env.PLUGIN_ROOT ? "claude" : "codex";
}

function routeHintForInput(input = {}) {
  const prompt = extractPrompt(input);
  const routeInput = {
    ...input,
    prompt,
    platform: input.platform || defaultPlatform(),
    cwd: input.cwd || input.workspace || input.projectRoot || process.cwd(),
  };
  const output = childProcess.execFileSync(
    pythonCommand(),
    [RUNNER, "route", "--input-json", JSON.stringify(routeInput), "--json"],
    {
      cwd: ROOT,
      encoding: "utf8",
      env: {
        ...process.env,
        PYTHONPATH: [ROOT, process.env.PYTHONPATH].filter(Boolean).join(path.delimiter),
      },
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 4000,
    },
  );
  return JSON.parse(output);
}

function formatRouteHint(routeHint) {
  if (!routeHint) return "";
  const skills = routeHint.skills.length > 0 ? routeHint.skills.join(", ") : "none";
  const roles = routeHint.agents.roles.length > 0 ? routeHint.agents.roles.join(", ") : "none";
  const next = routeActionHint(routeHint);
  return `Sinan route: taskSize=${routeHint.taskSize}; intent=${routeHint.intent}; workflow=${
    routeHint.workflow || "none"
  }; nativeMode=${routeHint.nativeMode}; skills=${skills}; agents=${routeHint.agents.count} (${roles}); budget=${
    routeHint.budget
  }. Reason: ${routeHint.reason}${next}`;
}

function routeActionHint(routeHint) {
  const parts = [];
  switch (routeHint.workflow) {
    case "bootstrap":
      parts.push("run the packaged Sinan CLI bootstrap for this target before asking stack questions or writing files");
      break;
    case "scaffold":
      parts.push("run the packaged Sinan CLI audit/scaffold for this target before writing agent surfaces");
      break;
    case "starter":
      parts.push("confirm bootstrap/scaffold gates first, then generate starter files only after product and architecture choices are clear");
      break;
    default:
      break;
  }
  if (routeHint.nextCommand) parts.push(`required first command: \`${routeHint.nextCommand}\` (substitute the packaged sinanCli)`);
  if (parts.length === 0) return "";
  return ` Next: ${parts.join("; ")}.`;
}

function promptRouter(input = {}) {
  const prompt = extractPrompt(input);
  if (!prompt) return null;

  const routeHint = routeHintForInput(input);
  return additionalContextOutput("UserPromptSubmit", formatRouteHint(routeHint));
}

if (require.main === module) {
  runHook(promptRouter);
}

module.exports = {
  defaultPlatform,
  formatRouteHint,
  routeActionHint,
  promptRouter,
  routeHintForInput,
  routeHintForPrompt,
};

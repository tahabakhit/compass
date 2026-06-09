#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { resolveWorkflowPath, validateWorkflowFile } = require("./workflow-validate");

const ROOT = path.resolve(__dirname, "..");

function defaultCapabilities(platform) {
  return {
    planMode: true,
    subagents: true,
    dynamicWorkflows: platform === "claude",
    hooks: true,
    mcp: true,
  };
}

function parseCsv(value) {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseArgs(argv) {
  const args = {
    workflow: null,
    target: process.cwd(),
    platform: "codex",
    conditions: [],
    agents: null,
    dryRun: true,
    persist: false,
    resume: null,
    confirmation: false,
    capabilities: null,
    json: false,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--workflow") args.workflow = argv[++index];
    else if (arg === "--target") args.target = argv[++index];
    else if (arg === "--platform") args.platform = argv[++index];
    else if (arg === "--conditions") args.conditions = parseCsv(argv[++index]);
    else if (arg === "--agents") args.agents = Number.parseInt(argv[++index], 10);
    else if (arg === "--persist") args.persist = true;
    else if (arg === "--execute") args.dryRun = false;
    else if (arg === "--resume") args.resume = argv[++index];
    else if (arg === "--confirm-large") args.confirmation = true;
    else if (arg === "--capabilities") args.capabilities = JSON.parse(argv[++index]);
    else if (arg === "--json") args.json = true;
    else if (arg === "--help") {
      printHelp();
      process.exit(0);
    } else if (!args.workflow) {
      args.workflow = arg;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!args.workflow && !args.resume) {
    throw new Error("Workflow id/path is required unless --resume is provided");
  }
  if (!["codex", "claude"].includes(args.platform)) {
    throw new Error("--platform must be codex or claude");
  }

  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/workflow-run.js --workflow implement [options]

Dry-run is the default. This runner produces a deterministic execution plan; it
does not spawn agents or run gates yet.

Options:
  --target <path>             Target repository path.
  --platform codex|claude     Platform native-mode selection.
  --conditions a,b            Conditions that enable conditional phases.
  --agents <n>                Requested agent count.
  --confirm-large             Allow large workflow budget.
  --persist                   Write a compact summaries-only state file.
  --resume <state-file>       Resume from a previous state file.
  --capabilities <json>       Override platform capabilities.
  --json                      Print JSON.
`);
}

function expandPhases(workflow, conditions) {
  const conditionSet = new Set(conditions);
  return workflow.phases
    .filter((phase) => !phase.when || conditionSet.has(phase.when))
    .map((phase, index) => ({
      index: index + 1,
      id: phase.id,
      conditional: Boolean(phase.when),
      when: phase.when || null,
    }));
}

function selectNativeMode(workflow, platform, capabilities) {
  const nativeHint = workflow.native ? workflow.native[platform] : "none";

  if (platform === "claude") {
    if (nativeHint === "dynamic_workflow_optional" && capabilities.dynamicWorkflows) {
      return "claude-dynamic-workflow";
    }
    if ((nativeHint === "plan_mode_optional" || nativeHint === "plan_mode_required") && capabilities.planMode) {
      return "claude-plan";
    }
    return "none";
  }

  if ((nativeHint === "plan_mode_optional" || nativeHint === "plan_mode_required") && capabilities.planMode) {
    return "codex-plan";
  }
  if (nativeHint === "subagents_allowed" && capabilities.subagents) {
    return "codex-subagents";
  }
  return "none";
}

function resolveAgentBudget(workflow, requestedAgents, capabilities) {
  const defaultAgents = workflow.budget.default_agents;
  const requested = Number.isInteger(requestedAgents) ? requestedAgents : defaultAgents;
  if (requested < 0) throw new Error("--agents must be zero or greater");
  const capped = Math.min(requested, workflow.budget.max_agents);
  return capabilities.subagents ? capped : 0;
}

function createRunId(workflowId, target, options = {}) {
  if (options.stable) return `${workflowId}-dry-run`;

  const hash = crypto
    .createHash("sha256")
    .update(`${workflowId}:${path.resolve(target)}:${Date.now()}`)
    .digest("hex")
    .slice(0, 12);
  return `${workflowId}-${hash}`;
}

function statePathFor(workflow, target, runId) {
  const stateDir = workflow.resume ? workflow.resume.state_dir : ".sinan/runs";
  return path.join(path.resolve(target), stateDir, `${runId}.json`);
}

function workflowSourcePointer(workflowId) {
  const yamlPointer = `workflows/${workflowId}.yaml`;
  if (fs.existsSync(path.join(ROOT, yamlPointer))) return yamlPointer;
  return `runtime/workflows/${workflowId}.json`;
}

function loadState(statePath) {
  return JSON.parse(fs.readFileSync(statePath, "utf8"));
}

function validateResumeState(state) {
  if (state.schemaVersion !== 1) throw new Error("Resume state schemaVersion must be 1");
  if (state.persist !== "summaries_only") throw new Error("Resume state must persist summaries_only");
  if (state.rawTranscript) throw new Error("Resume state must not contain rawTranscript");
  if (!state.workflow || !state.runId || !state.target || !state.platform) {
    throw new Error("Resume state is missing workflow, runId, target, or platform");
  }
  if (!state.summary || !Array.isArray(state.summary.phases) || !Array.isArray(state.summary.gates)) {
    throw new Error("Resume state is missing summary phases or gates");
  }
  if (!state.sourcePointers || !state.sourcePointers.workflow) {
    throw new Error("Resume state is missing sourcePointers.workflow");
  }
}

function createDryRunPlan(workflow, options) {
  const target = path.resolve(options.target);
  const capabilities = options.capabilities || defaultCapabilities(options.platform);

  if (workflow.mode.default === "large" && workflow.budget.confirmation_required && !options.confirmation) {
    throw new Error(`Workflow ${workflow.id} is large and requires --confirm-large`);
  }

  const phases = expandPhases(workflow, options.conditions || []);
  const nativeMode = selectNativeMode(workflow, options.platform, capabilities);
  const agentCount = resolveAgentBudget(workflow, options.agents, capabilities);
  const runId = options.runId || createRunId(workflow.id, target, { stable: options.persist !== true });

  return {
    schemaVersion: 1,
    workflow: workflow.id,
    description: workflow.description,
    target,
    platform: options.platform,
    dryRun: options.dryRun !== false,
    nativeMode,
    budget: {
      mode: workflow.mode.default,
      defaultAgents: workflow.budget.default_agents,
      maxAgents: workflow.budget.max_agents,
      requestedAgents: Number.isInteger(options.agents) ? options.agents : workflow.budget.default_agents,
      plannedAgents: agentCount,
      maxTokens: workflow.budget.max_tokens || null,
      maxMinutes: workflow.budget.max_minutes || null,
      confirmationRequired: Boolean(workflow.budget.confirmation_required),
      confirmationProvided: Boolean(options.confirmation),
    },
    phases,
    gates: workflow.gates.map((gate) => ({ id: gate, status: "pending" })),
    resume: workflow.resume
      ? {
          stateDir: workflow.resume.state_dir,
          persist: workflow.resume.persist,
        }
      : null,
    runId,
  };
}

function persistState(plan) {
  if (!plan.resume || plan.resume.persist !== "summaries_only") {
    throw new Error(`Workflow ${plan.workflow} does not support summaries-only persistence`);
  }

  const statePath = path.join(plan.target, plan.resume.stateDir, `${plan.runId}.json`);
  fs.mkdirSync(path.dirname(statePath), { recursive: true });

  const state = {
    schemaVersion: 1,
    workflow: plan.workflow,
    runId: plan.runId,
    target: plan.target,
    platform: plan.platform,
    persist: "summaries_only",
    summary: {
      description: plan.description,
      phases: plan.phases.map((phase) => phase.id),
      gates: plan.gates.map((gate) => gate.id),
      nativeMode: plan.nativeMode,
      plannedAgents: plan.budget.plannedAgents,
    },
    sourcePointers: {
      workflow: workflowSourcePointer(plan.workflow),
    },
  };

  fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);
  return statePath;
}

function runWorkflow(options) {
  if (options.resume) {
    const state = loadState(path.resolve(options.resume));
    validateResumeState(state);
    const workflow = validateWorkflowFile(resolveWorkflowPath(state.workflow));
    const plan = createDryRunPlan(workflow, {
      ...options,
      target: state.target,
      platform: state.platform,
      runId: state.runId,
      confirmation: true,
    });
    return {
      ...plan,
      resumedFrom: path.resolve(options.resume),
    };
  }

  const workflow = validateWorkflowFile(resolveWorkflowPath(options.workflow));
  const plan = createDryRunPlan(workflow, options);
  if (options.persist) {
    return {
      ...plan,
      statePath: persistState(plan),
    };
  }
  return plan;
}

function renderText(plan) {
  const lines = [
    `Workflow: ${plan.workflow}`,
    `Target: ${plan.target}`,
    `Platform: ${plan.platform}`,
    `Mode: ${plan.budget.mode}`,
    `Native mode: ${plan.nativeMode}`,
    `Agents: ${plan.budget.plannedAgents}/${plan.budget.maxAgents}`,
    "Phases:",
    ...plan.phases.map((phase) => `  ${phase.index}. ${phase.id}${phase.conditional ? ` when ${phase.when}` : ""}`),
    "Gates:",
    ...plan.gates.map((gate) => `  - ${gate.id}: ${gate.status}`),
  ];
  if (plan.statePath) lines.push(`State: ${plan.statePath}`);
  if (plan.resumedFrom) lines.push(`Resumed from: ${plan.resumedFrom}`);
  return `${lines.join("\n")}\n`;
}

function main() {
  const args = parseArgs(process.argv);
  const plan = runWorkflow(args);
  if (args.json) {
    console.log(JSON.stringify(plan, null, 2));
  } else {
    process.stdout.write(renderText(plan));
  }
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = {
  createDryRunPlan,
  defaultCapabilities,
  expandPhases,
  persistState,
  runWorkflow,
  selectNativeMode,
  validateResumeState,
  workflowSourcePointer,
};

#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");

const SCHEMA_FILES = [
  "schemas/route-output.schema.json",
  "schemas/route-input.schema.json",
  "schemas/route-metadata.schema.json",
];

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), "utf8"));
}

function optionalRequire(moduleName) {
  try {
    return require(moduleName);
  } catch {
    return null;
  }
}

function readYaml(relativePath) {
  const YAML = optionalRequire("yaml");
  if (!YAML) throw new Error(`YAML runtime dependency is unavailable for ${relativePath}`);
  return YAML.parse(fs.readFileSync(path.join(ROOT, relativePath), "utf8"));
}

function readYamlOrRuntimeJson(yamlPath, runtimeJsonPath) {
  if (optionalRequire("yaml") && fs.existsSync(path.join(ROOT, yamlPath))) {
    return readYaml(yamlPath);
  }
  return readJson(runtimeJsonPath);
}

function buildAjv() {
  const Ajv = optionalRequire("ajv");
  if (!Ajv) return null;
  const ajv = new Ajv({ allErrors: true, strict: false });
  for (const schemaFile of SCHEMA_FILES) {
    if (!fs.existsSync(path.join(ROOT, schemaFile))) return null;
    ajv.addSchema(readJson(schemaFile));
  }
  return ajv;
}

function normalizePrompt(prompt) {
  return String(prompt || "")
    .toLowerCase()
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .trim();
}

function defaultInput(prompt) {
  return {
    prompt,
    cwd: process.cwd(),
    projectType: [],
    git: {
      branch: "",
      dirty: false,
      summary: "",
    },
    sinanState: {},
    platform: "codex",
    nativeCapabilities: {
      planMode: true,
      subagents: true,
      dynamicWorkflows: false,
      hooks: true,
      mcp: true,
    },
    availableSkills: [
      "task-router",
      "brainstorm",
      "decision-capture",
      "diagnose",
      "tdd",
      "review",
      "zoom-out",
      "architecture",
      "architecture-deepening",
      "scaffold",
      "starter",
      "handoff",
      "compress",
    ],
    availableWorkflows: [
      "clarify",
      "debug",
      "implement",
      "review",
      "research-audit",
      "cleanup",
      "architecture-sweep",
      "scaffold",
      "starter",
    ],
  };
}

function loadRules() {
  const metadata = readYamlOrRuntimeJson("routes/rules.yaml", "runtime/routes/rules.json");
  return [...metadata.rules].sort((left, right) => {
    if (right.priority !== left.priority) return right.priority - left.priority;
    return left.id.localeCompare(right.id);
  });
}

function promptMatches(rule, prompt) {
  const normalized = normalizePrompt(prompt);
  const includes = rule.match.anyPromptIncludes || [];
  return includes.some((needle) => normalized.includes(normalizePrompt(needle)));
}

function applyNativeCapabilities(route, input) {
  let nativeMode = route.nativeMode;

  if (input.platform === "claude") {
    if (
      route.workflow === "research-audit" &&
      route.taskSize === "workflow" &&
      input.nativeCapabilities.dynamicWorkflows
    ) {
      nativeMode = "claude-dynamic-workflow";
    } else if (route.nativeMode === "codex-plan" && input.nativeCapabilities.planMode) {
      nativeMode = "claude-plan";
    } else if (route.nativeMode === "codex-plan") {
      nativeMode = "none";
    }
  } else if (route.nativeMode === "codex-plan" && !input.nativeCapabilities.planMode) {
    nativeMode = "none";
  } else if (route.nativeMode === "codex-subagents" && !input.nativeCapabilities.subagents) {
    nativeMode = "none";
  } else if (route.nativeMode === "claude-dynamic-workflow" && !input.nativeCapabilities.dynamicWorkflows) {
    nativeMode = input.nativeCapabilities.planMode ? "codex-plan" : "none";
  }

  const agents = input.nativeCapabilities.subagents ? route.agents : { count: 0, roles: [] };
  return { ...route, nativeMode, agents };
}

function fallbackRoute(input) {
  const prompt = normalizePrompt(input.prompt);

  if (/\b(review|audit diff|pr feedback)\b/.test(prompt)) {
    return {
      taskSize: "full",
      intent: "review",
      workflow: "review",
      nativeMode: input.platform === "claude" ? "claude-plan" : "codex-plan",
      skills: ["review"],
      agents: { count: 1, roles: ["review"] },
      hooks: ["bash-guard"],
      budget: "medium",
      reason: "Review work needs evidence-backed findings.",
    };
  }

  if (/\b(brainstorm|think through|shape this idea|product direction|ambiguous|acceptance criteria)\b/.test(prompt)) {
    return {
      taskSize: "full",
      intent: "clarify",
      workflow: "clarify",
      nativeMode: input.platform === "claude" ? "claude-plan" : "codex-plan",
      skills: ["brainstorm"],
      agents: { count: 0, roles: [] },
      hooks: ["bash-guard"],
      budget: "small",
      reason: "Ambiguous work should be shaped before decisions or implementation.",
    };
  }

  if (/\b(decision capture|capture decisions|glossary\.md|adr|architecture decision)\b/.test(prompt)) {
    return {
      taskSize: "full",
      intent: "clarify",
      workflow: "clarify",
      nativeMode: input.platform === "claude" ? "claude-plan" : "codex-plan",
      skills: ["decision-capture"],
      agents: { count: 0, roles: [] },
      hooks: ["bash-guard"],
      budget: "small",
      reason: "Durable project memory should be confirmed before writing.",
    };
  }

  if (/\b(architecture before implementation|plan the architecture|choose the architecture|system shape|module boundaries|data shape)\b/.test(prompt)) {
    return {
      taskSize: "full",
      intent: "architecture",
      workflow: "architecture-sweep",
      nativeMode: input.platform === "claude" ? "claude-plan" : "codex-plan",
      skills: ["zoom-out", "architecture"],
      agents: { count: 1, roles: ["review"] },
      hooks: ["bash-guard"],
      budget: "medium",
      reason: "Architecture should choose boundaries before starter or implementation work.",
    };
  }

  if (/\b(setup|set up|scaffold|doctor)\b/.test(prompt)) {
    return {
      taskSize: "full",
      intent: "setup",
      workflow: "scaffold",
      nativeMode: input.platform === "claude" ? "claude-plan" : "codex-plan",
      skills: ["scaffold"],
      agents: { count: 0, roles: [] },
      hooks: ["bash-guard"],
      budget: "small",
      reason: "Agent scaffolding should inspect and propose before writing.",
    };
  }

  if (/\b(starter|app starter|generate starter|initial app files|framework shell|application shell)\b/.test(prompt)) {
    return {
      taskSize: "full",
      intent: "setup",
      workflow: "starter",
      nativeMode: input.platform === "claude" ? "claude-plan" : "codex-plan",
      skills: ["starter"],
      agents: { count: 0, roles: [] },
      hooks: ["bash-guard"],
      budget: "medium",
      reason: "Starter generation should follow confirmed product and architecture decisions.",
    };
  }

  if (/\b(architecture|simplify|system map|deepening)\b/.test(prompt)) {
    return {
      taskSize: "full",
      intent: "architecture",
      workflow: "architecture-sweep",
      nativeMode: input.platform === "claude" ? "claude-plan" : "codex-plan",
      skills: prompt.includes("deepening") || prompt.includes("shallow module")
        ? ["zoom-out", "architecture-deepening"]
        : ["zoom-out", "architecture"],
      agents: { count: 1, roles: ["review"] },
      hooks: ["bash-guard"],
      budget: "medium",
      reason: "Architecture work benefits from system mapping.",
    };
  }

  return {
    taskSize: "light",
    intent: "research",
    workflow: null,
    nativeMode: "none",
    skills: [],
    agents: { count: 0, roles: [] },
    hooks: [],
    budget: "small",
    reason: "No heavy route matched; keep the task light.",
  };
}

function validateRouteOutput(route) {
  const ajv = buildAjv();
  if (!ajv) {
    const required = ["taskSize", "intent", "nativeMode", "skills", "agents", "hooks", "budget", "reason"];
    for (const key of required) {
      if (!(key in route)) throw new Error(`Route output is missing ${key}`);
    }
    if (!Array.isArray(route.skills)) throw new Error("Route output skills must be an array");
    if (!Array.isArray(route.hooks)) throw new Error("Route output hooks must be an array");
    if (!route.agents || typeof route.agents.count !== "number" || !Array.isArray(route.agents.roles)) {
      throw new Error("Route output agents must include count and roles");
    }
    return;
  }

  const validate = ajv.getSchema("https://sinan.local/schemas/route-output.schema.json");
  if (!validate(route)) {
    const message = ajv.errorsText(validate.errors, { separator: "\n  " });
    throw new Error(`Route output failed schema validation:\n  ${message}`);
  }
}

function route(input, options = {}) {
  const routeInput = typeof input === "string" ? defaultInput(input) : { ...defaultInput(input.prompt), ...input };
  const rules = options.rules || loadRules();
  const matchedRule = rules.find((rule) => promptMatches(rule, routeInput.prompt));
  const selectedRoute = matchedRule ? applyNativeCapabilities(matchedRule.route, routeInput) : applyNativeCapabilities(fallbackRoute(routeInput), routeInput);
  validateRouteOutput(selectedRoute);
  return selectedRoute;
}

function parseArgs(argv) {
  const args = {
    prompt: null,
    input: null,
    pretty: true,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--prompt") args.prompt = argv[++index];
    else if (arg === "--input") args.input = argv[++index];
    else if (arg === "--compact") args.pretty = false;
    else if (arg === "--help") {
      printHelp();
      process.exit(0);
    } else if (!args.prompt) {
      args.prompt = arg;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/route.js --prompt "Add OAuth login"

Options:
  --prompt <text>  Prompt text to classify.
  --input <file>   JSON route input object.
  --compact        Print compact JSON.
`);
}

function main() {
  const args = parseArgs(process.argv);
  let input;

  if (args.input) {
    input = readJson(path.relative(ROOT, path.resolve(args.input)));
  } else if (args.prompt) {
    input = defaultInput(args.prompt);
  } else {
    const stdin = fs.readFileSync(0, "utf8").trim();
    if (!stdin) {
      printHelp();
      process.exit(1);
    }
    input = defaultInput(stdin);
  }

  const result = route(input);
  process.stdout.write(`${JSON.stringify(result, null, args.pretty ? 2 : 0)}\n`);
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
  defaultInput,
  fallbackRoute,
  applyNativeCapabilities,
  loadRules,
  normalizePrompt,
  route,
  validateRouteOutput,
};

#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const WORKFLOW_SCHEMA_ID = "https://sinan.local/schemas/workflow.schema.json";

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

function readYamlFile(filePath) {
  const YAML = optionalRequire("yaml");
  if (!YAML) throw new Error(`YAML runtime dependency is unavailable for ${filePath}`);
  return YAML.parse(fs.readFileSync(filePath, "utf8"));
}

function buildAjv() {
  const Ajv = optionalRequire("ajv");
  if (!Ajv || !fs.existsSync(path.join(ROOT, "schemas/workflow.schema.json"))) return null;
  const ajv = new Ajv({ allErrors: true, strict: false });
  ajv.addSchema(readJson("schemas/workflow.schema.json"));
  return ajv;
}

function listWorkflowFiles() {
  return fs
    .readdirSync(path.join(ROOT, "workflows"))
    .filter((name) => name.endsWith(".yaml"))
    .sort()
    .map((name) => path.join(ROOT, "workflows", name));
}

function resolveWorkflowPath(idOrPath) {
  if (!idOrPath) throw new Error("Workflow id or path is required");
  if (idOrPath.endsWith(".yaml") || idOrPath.includes("/") || idOrPath.includes(path.sep)) {
    return path.resolve(idOrPath);
  }
  return path.join(ROOT, "workflows", `${idOrPath}.yaml`);
}

function validateWorkflowFile(filePath, options = {}) {
  const ajv = options.ajv || buildAjv();
  const workflow = readWorkflowFile(filePath);
  const label = path.relative(ROOT, filePath);

  if (ajv) {
    const { assertWorkflowSemantics, assertValid } = require("./validate-schemas");
    assertValid(ajv, WORKFLOW_SCHEMA_ID, workflow, label);
    assertWorkflowSemantics(workflow, label);
  } else {
    assertWorkflowSemanticsLite(workflow, label);
  }

  const expectedId = path.basename(filePath, ".yaml");
  if (workflow.id !== expectedId) {
    throw new Error(`${label} id must match file name`);
  }

  return workflow;
}

function validateAllWorkflows() {
  const ajv = buildAjv();
  return listWorkflowFiles().map((filePath) => validateWorkflowFile(filePath, { ajv }));
}

function readWorkflowFile(filePath) {
  const YAML = optionalRequire("yaml");
  if (YAML && fs.existsSync(filePath)) return readYamlFile(filePath);

  const workflowId = path.basename(filePath, ".yaml");
  const runtimePath = path.join(ROOT, "runtime", "workflows", `${workflowId}.json`);
  return JSON.parse(fs.readFileSync(runtimePath, "utf8"));
}

function assertWorkflowSemanticsLite(workflow, label) {
  if (!workflow || typeof workflow !== "object") throw new Error(`${label} must be an object`);
  if (!workflow.id || !workflow.description) throw new Error(`${label} is missing id or description`);
  if (!workflow.mode || !workflow.mode.default) throw new Error(`${label} is missing mode.default`);
  if (!Array.isArray(workflow.phases) || workflow.phases.length === 0) throw new Error(`${label} is missing phases`);
  if (!Array.isArray(workflow.gates) || workflow.gates.length === 0) throw new Error(`${label} is missing gates`);
  if (!workflow.budget) throw new Error(`${label} is missing budget`);
  if (workflow.budget.default_agents > workflow.budget.max_agents) {
    throw new Error(`${label} has default_agents greater than max_agents`);
  }
  if (workflow.mode.default === "large" && workflow.budget.confirmation_required !== true) {
    throw new Error(`${label} is large but does not require confirmation`);
  }

  const phaseIds = workflow.phases.map((phase) => phase.id);
  if (new Set(phaseIds).size !== phaseIds.length) throw new Error(`${label} has duplicate phase ids`);
}

function parseArgs(argv) {
  const args = {
    workflow: null,
    json: false,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--workflow") args.workflow = argv[++index];
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

  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/workflow-validate.js [workflow-id|path] [--json]

Without a workflow argument, validates every workflow in workflows/.
`);
}

function main() {
  const args = parseArgs(process.argv);
  const workflows = args.workflow
    ? [validateWorkflowFile(resolveWorkflowPath(args.workflow))]
    : validateAllWorkflows();

  if (args.json) {
    console.log(JSON.stringify({ ok: true, workflows: workflows.map((workflow) => workflow.id) }, null, 2));
  } else {
    console.log(`workflow validation passed: ${workflows.map((workflow) => workflow.id).join(", ")}`);
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
  assertWorkflowSemanticsLite,
  listWorkflowFiles,
  readWorkflowFile,
  resolveWorkflowPath,
  validateAllWorkflows,
  validateWorkflowFile,
};

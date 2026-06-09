#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { route } = require("./route");

const ROOT = path.resolve(__dirname, "..");

function optionalRequire(moduleName) {
  try {
    return require(moduleName);
  } catch {
    return null;
  }
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), "utf8"));
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

function estimateTokensFromBytes(bytes) {
  return Math.ceil(bytes / 4);
}

function skillSurfaceTokens(skillName) {
  let bytes = 0;
  for (const relativeChild of ["SKILL.md", "agents/openai.yaml"]) {
    const filePath = path.join(ROOT, "skills", skillName, relativeChild);
    if (fs.existsSync(filePath)) bytes += fs.statSync(filePath).size;
  }
  return estimateTokensFromBytes(bytes);
}

function activeSkillTokens(skills) {
  return skills.reduce((total, skillName) => total + skillSurfaceTokens(skillName), 0);
}

function loadBenchmark() {
  return readYamlOrRuntimeJson("benchmarks/observed-usage.yaml", "runtime/benchmarks/observed-usage.json");
}

function arraysEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function assertCase(benchmarkCase, actualRoute, activeTokens) {
  const expected = benchmarkCase.expected.route;
  const errors = [];
  for (const key of ["taskSize", "workflow", "nativeMode", "budget"]) {
    if (actualRoute[key] !== expected[key]) {
      errors.push(`${key} expected ${JSON.stringify(expected[key])}, got ${JSON.stringify(actualRoute[key])}`);
    }
  }
  for (const key of ["skills", "hooks"]) {
    if (!arraysEqual(actualRoute[key], expected[key])) {
      errors.push(`${key} expected ${JSON.stringify(expected[key])}, got ${JSON.stringify(actualRoute[key])}`);
    }
  }
  if (actualRoute.agents.count > expected.agents.maxCount) {
    errors.push(`agents.count expected <= ${expected.agents.maxCount}, got ${actualRoute.agents.count}`);
  }
  if (activeTokens > benchmarkCase.expected.maxActiveSkillTokens) {
    errors.push(
      `activeSkillTokens expected <= ${benchmarkCase.expected.maxActiveSkillTokens}, got ${activeTokens}`,
    );
  }
  return errors;
}

function increment(map, key) {
  const normalized = key === null || key === undefined ? "none" : String(key);
  map[normalized] = (map[normalized] || 0) + 1;
}

function runBenchmark() {
  const benchmark = loadBenchmark();
  const cases = [];
  const summary = {
    caseCount: 0,
    microCases: 0,
    workflowCases: 0,
    totalAgentCount: 0,
    maxActiveSkillTokens: 0,
    taskSizes: {},
    workflows: {},
    skills: {},
    hooks: {},
  };

  for (const benchmarkCase of benchmark.cases) {
    const actualRoute = route(benchmarkCase.prompt);
    const activeTokens = activeSkillTokens(actualRoute.skills);
    const errors = assertCase(benchmarkCase, actualRoute, activeTokens);
    const result = {
      id: benchmarkCase.id,
      prompt: benchmarkCase.prompt,
      ok: errors.length === 0,
      errors,
      route: actualRoute,
      activeSkillTokens: activeTokens,
    };
    cases.push(result);

    summary.caseCount += 1;
    if (actualRoute.taskSize === "micro") summary.microCases += 1;
    if (actualRoute.taskSize === "workflow") summary.workflowCases += 1;
    summary.totalAgentCount += actualRoute.agents.count;
    summary.maxActiveSkillTokens = Math.max(summary.maxActiveSkillTokens, activeTokens);
    increment(summary.taskSizes, actualRoute.taskSize);
    increment(summary.workflows, actualRoute.workflow);
    for (const skillName of actualRoute.skills) increment(summary.skills, skillName);
    for (const hookName of actualRoute.hooks) increment(summary.hooks, hookName);
  }

  return {
    schemaVersion: benchmark.schemaVersion,
    description: benchmark.description,
    summary,
    cases,
  };
}

function parseArgs(argv) {
  return {
    check: argv.includes("--check"),
    json: argv.includes("--json"),
  };
}

function printText(report) {
  console.log("observed usage benchmark");
  console.log(`cases: ${report.summary.caseCount}`);
  console.log(`micro cases: ${report.summary.microCases}`);
  console.log(`workflow cases: ${report.summary.workflowCases}`);
  console.log(`total agent count: ${report.summary.totalAgentCount}`);
  console.log(`max active skill tokens: ${report.summary.maxActiveSkillTokens}`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const report = runBenchmark();
  const failingCases = report.cases.filter((benchmarkCase) => !benchmarkCase.ok);
  if (args.json) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  else printText(report);

  if (args.check && failingCases.length > 0) {
    const messages = failingCases.flatMap((benchmarkCase) =>
      benchmarkCase.errors.map((error) => `${benchmarkCase.id}: ${error}`),
    );
    throw new Error(`observed usage benchmark failed:\n  ${messages.join("\n  ")}`);
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
  activeSkillTokens,
  loadBenchmark,
  runBenchmark,
};

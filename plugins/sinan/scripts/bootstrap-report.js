#!/usr/bin/env node
"use strict";

const childProcess = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const HANDOFF_PATHS = ["HANDOFF.md", "handoff.md", "docs/HANDOFF.md", "docs/handoff.md"];
const RUN_DIRS = [".sinan/runs", ".planning/sinan"];
const AGENT_FILES = ["AGENTS.md", "CLAUDE.md"];
const MEMORY_FILES = ["GLOSSARY.md", "docs/adr"];
const PACKAGE_FILES = ["package.json", "pnpm-lock.yaml", "yarn.lock", "package-lock.json", "bun.lockb", "bun.lock"];
const APP_HINTS = ["src", "app", "pages", "public", "index.html", "vite.config.js", "next.config.js"];

function parseArgs(argv) {
  const args = { target: process.cwd(), json: false };
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--target") args.target = argv[++index];
    else if (arg === "--json") args.json = true;
    else if (arg === "--help") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/bootstrap-report.js [--target <repo>] [--json]

Inspects repo startup state, prior handoffs, and recommended Sinan next steps.
`);
}

function exists(target, relativePath) {
  return fs.existsSync(path.join(target, relativePath));
}

function isDirectory(target, relativePath) {
  const filePath = path.join(target, relativePath);
  return fs.existsSync(filePath) && fs.statSync(filePath).isDirectory();
}

function listTopLevel(target) {
  return fs
    .readdirSync(target, { withFileTypes: true })
    .filter((entry) => entry.name !== ".git" && entry.name !== "node_modules")
    .map((entry) => entry.name)
    .sort();
}

function safeRun(command, args, cwd) {
  try {
    return childProcess.execFileSync(command, args, {
      cwd,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

function readPackageJson(target) {
  const packagePath = path.join(target, "package.json");
  if (!fs.existsSync(packagePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(packagePath, "utf8"));
  } catch {
    return null;
  }
}

function detectPackageManager(target) {
  if (exists(target, "pnpm-lock.yaml")) return "pnpm";
  if (exists(target, "yarn.lock")) return "yarn";
  if (exists(target, "bun.lock") || exists(target, "bun.lockb")) return "bun";
  if (exists(target, "package-lock.json")) return "npm";
  if (exists(target, "package.json")) return "npm";
  return null;
}

function detectFrameworks(target, packageJson) {
  const dependencies = {
    ...(packageJson && packageJson.dependencies),
    ...(packageJson && packageJson.devDependencies),
  };
  const frameworks = [];
  for (const name of ["next", "react", "vue", "svelte", "astro", "vite", "express", "fastify"]) {
    if (dependencies && dependencies[name]) frameworks.push(name);
  }
  if (exists(target, "next.config.js") || exists(target, "next.config.mjs")) frameworks.push("next");
  if (exists(target, "vite.config.js") || exists(target, "vite.config.ts")) frameworks.push("vite");
  return [...new Set(frameworks)].sort();
}

function detectHandoffs(target) {
  const seenFiles = new Set();
  const files = [];
  for (const relativePath of HANDOFF_PATHS) {
    const filePath = path.join(target, relativePath);
    if (!fs.existsSync(filePath)) continue;
    const realPath = fs.realpathSync(filePath).toLowerCase();
    if (seenFiles.has(realPath)) continue;
    seenFiles.add(realPath);
    files.push(relativePath);
  }
  const runDirs = RUN_DIRS.filter((relativePath) => isDirectory(target, relativePath));
  const continuationFiles = listTopLevel(target).filter((name) => /continuation|resume/i.test(name));
  return {
    found: files.length > 0 || runDirs.length > 0 || continuationFiles.length > 0,
    files,
    runDirs,
    continuationFiles,
  };
}

function classifyState(signals) {
  if (signals.handoffs.found) return "resumed-from-handoff";
  if (signals.appHints.length > 0 || signals.frameworks.length > 0) return "app-started";
  if (signals.packageFiles.length > 0 || signals.hasReadme || signals.hasGit) return "foundation-only";
  if (signals.topLevelCount === 0) return "empty";
  return "established";
}

function recommendSteps(state, signals) {
  const steps = [];
  const skipped = [];

  if (signals.handoffs.found) {
    steps.push("handoff");
    skipped.push({ step: "starter", reason: "Prior handoff should be read before generating app files." });
  }

  if (!signals.hasGlossary && !signals.hasAdr) steps.push("brainstorm", "decision-capture");
  else skipped.push({ step: "decision-capture", reason: "Project memory already exists; update only if decisions changed." });

  if (!signals.hasAdr) steps.push("architecture");
  else skipped.push({ step: "architecture", reason: "ADR directory exists; inspect before adding new decisions." });

  if (!signals.hasAgentFiles) steps.push("scaffold");
  else skipped.push({ step: "scaffold", reason: "Agent instruction files already exist; run scaffold only to refresh." });

  if (state === "empty" || state === "foundation-only") steps.push("starter");
  else skipped.push({ step: "starter", reason: "Repo already appears to have app files or established structure." });

  if (state === "app-started" || state === "established" || state === "resumed-from-handoff") steps.push("tdd");

  return {
    nextSteps: [...new Set(steps)],
    skipped,
  };
}

function commandForStep(step, target) {
  const quotedTarget = JSON.stringify(target);
  const commands = {
    handoff: "Read the existing handoff before changing files.",
    brainstorm: "Use $brainstorm to clarify users, constraints, non-goals, and first vertical slice.",
    "decision-capture": "Use $decision-capture after terms or decisions stabilize.",
    architecture: "Use $architecture to choose boundaries, modules, data shape, integrations, and first slice.",
    scaffold: `node scripts/scaffold-instructions.js --target ${quotedTarget}`,
    starter: `node scripts/starter-plan.js --target ${quotedTarget} --json`,
    tdd: "Use $tdd for the next verified implementation slice.",
  };
  return commands[step] || `Use $${step}.`;
}

function reasonForStep(step, state, signals) {
  if (step === "handoff") return "Prior handoff or continuation state exists; read it before proposing startup work.";
  if (step === "brainstorm") return "No durable project memory was detected; clarify direction before writing decisions.";
  if (step === "decision-capture") return "No GLOSSARY.md or ADR directory was detected; stable terms and decisions need a home.";
  if (step === "architecture") return "No ADR directory was detected; choose boundaries before starter or implementation work.";
  if (step === "scaffold") return "AGENTS.md and CLAUDE.md were not both detected; agent guidance should be created or refreshed.";
  if (step === "starter") return "Repo is empty or foundation-only; starter files may be appropriate after decisions are confirmed.";
  if (step === "tdd") return state === "resumed-from-handoff"
    ? "Repo is resumed from prior work; continue with the next verified implementation slice after reading handoff."
    : "Repo already has app or established structure; continue with a verified implementation slice.";
  return signals.handoffs.found ? "Prior handoff exists; proceed conservatively." : "Recommended by bootstrap report.";
}

function buildPlan(state, signals, recommendations, target) {
  return recommendations.nextSteps.map((step, index) => ({
    order: index + 1,
    step,
    reason: reasonForStep(step, state, signals),
    command: commandForStep(step, target),
  }));
}

function buildReport(target) {
  const resolvedTarget = path.resolve(target);
  if (!fs.existsSync(resolvedTarget) || !fs.statSync(resolvedTarget).isDirectory()) {
    throw new Error(`target must be a directory: ${resolvedTarget}`);
  }

  const topLevel = listTopLevel(resolvedTarget);
  const packageJson = readPackageJson(resolvedTarget);
  const packageFiles = PACKAGE_FILES.filter((relativePath) => exists(resolvedTarget, relativePath));
  const appHints = APP_HINTS.filter((relativePath) => exists(resolvedTarget, relativePath));
  const handoffs = detectHandoffs(resolvedTarget);
  const gitStatus = safeRun("git", ["status", "--short"], resolvedTarget);
  const recentCommits = safeRun("git", ["log", "-3", "--oneline"], resolvedTarget);
  const workflows = isDirectory(resolvedTarget, ".github/workflows")
    ? fs.readdirSync(path.join(resolvedTarget, ".github/workflows")).sort()
    : [];

  const signals = {
    topLevelCount: topLevel.length,
    hasGit: isDirectory(resolvedTarget, ".git"),
    gitDirty: Boolean(gitStatus),
    gitStatus: gitStatus || "",
    recentCommits: recentCommits ? recentCommits.split("\n") : [],
    hasReadme: exists(resolvedTarget, "README.md"),
    packageManager: detectPackageManager(resolvedTarget),
    packageFiles,
    frameworks: detectFrameworks(resolvedTarget, packageJson),
    appHints,
    hasAgentFiles: AGENT_FILES.some((relativePath) => exists(resolvedTarget, relativePath)),
    agentFiles: AGENT_FILES.filter((relativePath) => exists(resolvedTarget, relativePath)),
    hasGlossary: exists(resolvedTarget, "GLOSSARY.md"),
    hasAdr: isDirectory(resolvedTarget, "docs/adr"),
    memoryFiles: MEMORY_FILES.filter((relativePath) => exists(resolvedTarget, relativePath)),
    githubWorkflows: workflows,
    handoffs,
  };

  const state = classifyState(signals);
  const recommendations = recommendSteps(state, signals);
  return {
    target: resolvedTarget,
    state,
    signals,
    recommendations,
    plan: buildPlan(state, signals, recommendations, resolvedTarget),
  };
}

function printText(report) {
  console.log("bootstrap report");
  console.log(`target: ${report.target}`);
  console.log(`state: ${report.state}`);
  console.log(`handoff found: ${report.signals.handoffs.found ? "yes" : "no"}`);
  console.log(`package manager: ${report.signals.packageManager || "none"}`);
  console.log(`frameworks: ${report.signals.frameworks.length ? report.signals.frameworks.join(", ") : "none"}`);
  console.log(`next steps: ${report.recommendations.nextSteps.join(", ") || "none"}`);
  if (report.plan.length > 0) {
    console.log("plan:");
    for (const item of report.plan) console.log(`  ${item.order}. ${item.step}: ${item.command}`);
  }
  if (report.recommendations.skipped.length > 0) {
    console.log("skipped:");
    for (const item of report.recommendations.skipped) console.log(`  ${item.step}: ${item.reason}`);
  }
}

function main() {
  const args = parseArgs(process.argv);
  const report = buildReport(args.target);
  if (args.json) process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  else printText(report);
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
  buildReport,
  buildPlan,
  classifyState,
  recommendSteps,
};

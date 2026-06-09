#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

function parseArgs(argv) {
  const args = { target: process.cwd(), json: false, framework: null };
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--target") args.target = argv[++index];
    else if (arg === "--framework") args.framework = argv[++index];
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
  console.log(`Usage: node scripts/starter-plan.js [--target <repo>] [--framework <name>] [--json]

Produces a dry-run starter file plan. This command writes no files.
`);
}

function exists(target, relativePath) {
  return fs.existsSync(path.join(target, relativePath));
}

function readPackageJson(target) {
  const filePath = path.join(target, "package.json");
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
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
  return "npm";
}

function detectFramework(target, packageJson, override) {
  if (override) return override;
  const deps = {
    ...(packageJson && packageJson.dependencies),
    ...(packageJson && packageJson.devDependencies),
  };
  if (deps.next || exists(target, "next.config.js") || exists(target, "next.config.mjs")) return "next";
  if (deps.vite || exists(target, "vite.config.js") || exists(target, "vite.config.ts")) return "vite";
  if (deps.react) return "react";
  return "node";
}

function packageRun(manager, script) {
  if (manager === "pnpm") return `pnpm ${script}`;
  if (manager === "yarn") return `yarn ${script}`;
  if (manager === "bun") return `bun run ${script}`;
  return `npm run ${script}`;
}

function filePlanFor(framework) {
  if (framework === "next") {
    return [
      { path: "app/page.tsx", purpose: "First route for the vertical slice." },
      { path: "app/layout.tsx", purpose: "Root layout for the app shell." },
      { path: "app/globals.css", purpose: "Minimal global styles." },
      { path: "next.config.js", purpose: "Framework config if missing." },
    ];
  }
  if (framework === "vite" || framework === "react") {
    return [
      { path: "src/main.tsx", purpose: "Browser entry point." },
      { path: "src/App.tsx", purpose: "First app screen for the vertical slice." },
      { path: "src/App.test.tsx", purpose: "Starter rendering test." },
      { path: "index.html", purpose: "HTML entry file." },
      { path: "vite.config.ts", purpose: "Vite config if missing." },
    ];
  }
  return [
    { path: "src/index.ts", purpose: "Application entry point." },
    { path: "src/index.test.ts", purpose: "Starter test for the first slice." },
    { path: "package.json", purpose: "Scripts and package metadata if missing." },
  ];
}

function buildPlan(options = {}) {
  const target = path.resolve(options.target || process.cwd());
  if (!fs.existsSync(target) || !fs.statSync(target).isDirectory()) {
    throw new Error(`target must be a directory: ${target}`);
  }

  const packageJson = readPackageJson(target);
  const packageManager = detectPackageManager(target);
  const framework = detectFramework(target, packageJson, options.framework);
  const plannedFiles = filePlanFor(framework).map((file) => ({
    ...file,
    exists: exists(target, file.path),
    action: exists(target, file.path) ? "preserve" : "create",
  }));
  const hasDecisions = exists(target, "GLOSSARY.md") || exists(target, "docs/adr");
  const hasAgentGuidance = exists(target, "AGENTS.md") || exists(target, "CLAUDE.md");
  const hasAppFiles = ["src", "app", "pages", "index.html"].some((relativePath) => exists(target, relativePath));

  return {
    target,
    mode: "dry-run",
    writesFiles: false,
    framework,
    packageManager,
    readiness: {
      hasDecisions,
      hasAgentGuidance,
      hasAppFiles,
      canGenerate: hasDecisions && !hasAppFiles,
      blockers: [
        ...(!hasDecisions ? ["Confirm product and architecture decisions before generating starter files."] : []),
        ...(hasAppFiles ? ["Existing app files detected; preserve them unless the user explicitly asks to regenerate."] : []),
      ],
    },
    plannedFiles,
    commands: {
      install: packageManager === "npm" ? "npm install" : `${packageManager} install`,
      test: packageRun(packageManager, "test"),
      dev: packageRun(packageManager, "dev"),
    },
    nextStep: hasDecisions ? "Use $starter to generate files after confirming this plan." : "Use $decision-capture and $architecture before starter generation.",
  };
}

function printText(plan) {
  console.log("starter plan");
  console.log(`target: ${plan.target}`);
  console.log(`framework: ${plan.framework}`);
  console.log(`package manager: ${plan.packageManager}`);
  console.log(`writes files: ${plan.writesFiles ? "yes" : "no"}`);
  console.log("planned files:");
  for (const file of plan.plannedFiles) console.log(`  ${file.action} ${file.path}: ${file.purpose}`);
  if (plan.readiness.blockers.length > 0) {
    console.log("blockers:");
    for (const blocker of plan.readiness.blockers) console.log(`  ${blocker}`);
  }
  console.log(`next step: ${plan.nextStep}`);
}

function main() {
  const args = parseArgs(process.argv);
  const plan = buildPlan(args);
  if (args.json) process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
  else printText(plan);
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
  buildPlan,
  detectFramework,
  filePlanFor,
};

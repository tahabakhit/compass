#!/usr/bin/env node
"use strict";

const childProcess = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const PLANNING_HANDOFF_DIR = ".planning/handoffs";
const RUN_DIRS = [".workflow-state/runs"];
const AGENT_FILES = ["AGENTS.md", "CLAUDE.md"];
const MEMORY_FILES = ["GLOSSARY.md", "docs/adr"];
const PACKAGE_FILES = ["package.json", "pnpm-lock.yaml", "yarn.lock", "package-lock.json", "bun.lockb", "bun.lock"];
const APP_HINTS = ["src", "app", "pages", "public", "index.html", "vite.config.js", "next.config.js"];
const IGNORED_WORKSPACE_DIRS = new Set([
  ".git",
  ".planning",
  ".workflow-state",
  ".wiki",
  "docs",
  "node_modules",
  "vendor",
  ".venv",
]);
const WORKSPACE_POLICY = {
  planning:
    "Use workspace .planning/ for cross-repo brainstorms, plans, reviews, campaigns, and handoffs. Avoid child .planning/ unless that repo is being run as its own standalone workspace.",
  workflowState:
    "Use workspace .workflow-state/ for generated workspace maps, bootstrap reports, and run state. Child .workflow-state/ is only for runs launched directly inside that child repo.",
  repoDecisions:
    "Keep repo-specific architecture decisions in each child repo's docs/adr/. Use workspace docs/adr/ only for decisions that affect more than one repo.",
  repoCanonicalDocs:
    "Treat child docs/adr/, docs/agents/, docs/reference/, .github/, AGENTS.md, and CLAUDE.md as canonical repo-local documentation surfaces when present.",
  wiki:
    "Use repo .wiki/ for repo-local durable knowledge and ~/.wiki/ for personal or cross-project durable knowledge.",
};

function parseArgs(argv) {
  const args = { target: process.cwd(), json: false, persist: false, output: null };
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--target") args.target = argv[++index];
    else if (arg === "--persist") args.persist = true;
    else if (arg === "--output") args.output = argv[++index];
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
  console.log(`Usage: node scripts/bootstrap-report.js [--target <repo>] [--persist|--output <file>] [--json]

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

function hasGitRepository(target) {
  return fs.existsSync(path.join(target, ".git"));
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

function detectRepoSurfaces(repoPath) {
  const packageJson = readPackageJson(repoPath);
  const agentFiles = AGENT_FILES.filter((relativePath) => exists(repoPath, relativePath));
  return {
    hasReadme: exists(repoPath, "README.md"),
    hasAdr: isDirectory(repoPath, "docs/adr"),
    hasAgentDocs: isDirectory(repoPath, "docs/agents"),
    hasReferenceDocs: isDirectory(repoPath, "docs/reference"),
    hasGithub: isDirectory(repoPath, ".github"),
    hasAgentFiles: agentFiles.length > 0,
    agentFiles,
    hasPlanning: isDirectory(repoPath, ".planning"),
    hasWorkflowState: isDirectory(repoPath, ".workflow-state"),
    hasWiki: isDirectory(repoPath, ".wiki"),
    hasAgentsDir: isDirectory(repoPath, ".agents"),
    hasCitadel: isDirectory(repoPath, ".citadel"),
    hasPackageJson: Boolean(packageJson),
    packageManager: detectPackageManager(repoPath),
    frameworks: detectFrameworks(repoPath, packageJson),
  };
}

function parseDirtyStatus(status) {
  if (!status) return false;
  return status
    .split("\n")
    .some((line) => line.trim() && !line.startsWith("## "));
}

function detectNestedRepos(target) {
  const entries = fs.readdirSync(target, { withFileTypes: true });
  const repos = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (IGNORED_WORKSPACE_DIRS.has(entry.name)) continue;

    const repoPath = path.join(target, entry.name);
    if (!hasGitRepository(repoPath)) continue;

    const status = safeRun("git", ["status", "--short", "--branch"], repoPath) || "";
    repos.push({
      name: entry.name,
      relativePath: entry.name,
      branch: safeRun("git", ["branch", "--show-current"], repoPath) || null,
      remote: safeRun("git", ["remote", "get-url", "origin"], repoPath) || null,
      dirty: parseDirtyStatus(status),
      status,
      surfaces: detectRepoSurfaces(repoPath),
    });
  }

  return repos.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

function detectWorkspace(target, hasGit) {
  const repos = detectNestedRepos(target);
  let kind = "folder";
  if (repos.length > 0 && hasGit) kind = "repo-with-nested-repos";
  else if (repos.length > 0) kind = "workspace";
  else if (hasGit) kind = "repo";

  return {
    kind,
    repoCount: repos.length,
    repos,
    canonicalPolicy: WORKSPACE_POLICY,
  };
}

function detectHandoffs(target) {
  const files = [];
  const planningHandoffs = [];
  const planningDir = path.join(target, PLANNING_HANDOFF_DIR);
  if (fs.existsSync(planningDir) && fs.statSync(planningDir).isDirectory()) {
    for (const name of fs.readdirSync(planningDir).sort()) {
      if (name.startsWith(".") || !name.endsWith(".md")) continue;
      const relativePath = path.join(PLANNING_HANDOFF_DIR, name);
      planningHandoffs.push(relativePath);
      files.push(relativePath);
    }
  }
  const runDirs = RUN_DIRS.filter((relativePath) => isDirectory(target, relativePath));
  const continuationFiles = listTopLevel(target).filter((name) => /continuation|resume/i.test(name));
  return {
    found: files.length > 0 || runDirs.length > 0 || continuationFiles.length > 0,
    files,
    planningHandoffs,
    runDirs,
    continuationFiles,
  };
}

function classifyState(signals) {
  if (signals.handoffs.found) return "resumed-from-handoff";
  if (signals.workspace.kind === "workspace" || signals.workspace.kind === "repo-with-nested-repos") return "workspace";
  if (signals.appHints.length > 0 || signals.frameworks.length > 0) return "app-started";
  if (signals.packageFiles.length > 0 || signals.hasReadme || signals.hasGit) return "foundation-only";
  if (signals.topLevelCount === 0) return "empty";
  return "established";
}

function recommendSteps(state, signals) {
  const steps = [];
  const skipped = [];
  const isWorkspace = signals.workspace.kind === "workspace" || signals.workspace.kind === "repo-with-nested-repos";

  if (signals.handoffs.found) {
    steps.push("handoff");
    skipped.push({ step: "starter", reason: "Prior handoff should be read before generating app files." });
  }

  if (isWorkspace) {
    skipped.push({
      step: "brainstorm",
      reason: "Workspace-level brainstorms and plans should be created only for cross-repo work, not because child repos exist.",
    });
    if (!signals.hasAdr) steps.push("architecture");
    else skipped.push({ step: "architecture", reason: "Workspace ADR directory exists; use it only for cross-repo decisions." });
    skipped.push({
      step: "decision-capture",
      reason: "Repo-specific durable decisions belong in each child repo's docs/adr/.",
    });
  } else if (!signals.hasGlossary && !signals.hasAdr) steps.push("brainstorm", "decision-capture");
  else skipped.push({ step: "decision-capture", reason: "Project memory already exists; update only if decisions changed." });

  if (!isWorkspace) {
    if (!signals.hasAdr) steps.push("architecture");
    else skipped.push({ step: "architecture", reason: "ADR directory exists; inspect before adding new decisions." });
  }

  if (!signals.hasAgentFiles) steps.push("scaffold");
  else skipped.push({ step: "scaffold", reason: "Agent instruction files already exist; run scaffold only to refresh." });

  if (isWorkspace) {
    skipped.push({
      step: "starter",
      reason: "Workspace contains child repos; generate starter/app files only inside a selected child repo.",
    });
  } else if (state === "empty" || state === "foundation-only") steps.push("starter");
  else skipped.push({ step: "starter", reason: "Repo already appears to have app files or established structure." });

  if (state === "app-started" || state === "established" || state === "workspace" || state === "resumed-from-handoff") {
    steps.push("tdd");
  }

  return {
    nextSteps: [...new Set(steps)],
    skipped,
  };
}

function commandForStep(step, target) {
  const quotedTarget = JSON.stringify(target);
  const commands = {
    handoff: "Read .planning/handoffs/ before changing files.",
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
  if (step === "handoff") return "Prior handoff or continuation state exists; read canonical planning handoffs before proposing startup work.";
  if (step === "brainstorm") return "No durable project memory was detected; clarify direction before writing decisions.";
  if (step === "decision-capture") return "No GLOSSARY.md or ADR directory was detected; stable terms and decisions need a home.";
  if (step === "architecture") {
    return signals.workspace.repoCount > 0
      ? "Workspace contains child repos; capture only cross-repo architecture decisions at the workspace root."
      : "No ADR directory was detected; choose boundaries before starter or implementation work.";
  }
  if (step === "scaffold") return "AGENTS.md and CLAUDE.md were not both detected; agent guidance should be created or refreshed.";
  if (step === "starter") return "Repo is empty or foundation-only; starter files may be appropriate after decisions are confirmed.";
  if (step === "tdd") return state === "resumed-from-handoff"
    ? "Repo is resumed from prior work; continue with the next verified implementation slice after reading handoff."
    : state === "workspace"
      ? "Workspace contains child repos; choose the target repo and continue with a verified implementation slice there."
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
  const hasGit = hasGitRepository(resolvedTarget);
  const workspace = detectWorkspace(resolvedTarget, hasGit);
  const gitStatus = safeRun("git", ["status", "--short"], resolvedTarget);
  const recentCommits = safeRun("git", ["log", "-3", "--oneline"], resolvedTarget);
  const workflows = isDirectory(resolvedTarget, ".github/workflows")
    ? fs.readdirSync(path.join(resolvedTarget, ".github/workflows")).sort()
    : [];

  const signals = {
    topLevelCount: topLevel.length,
    hasGit,
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
    workspace,
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

function writePlanOutput(report, options = {}) {
  const outputPath = options.output
    ? path.resolve(options.output)
    : path.join(report.target, ".workflow-state", "plans", "bootstrap-report.json");
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  return outputPath;
}

function defaultWorkspaceMapPath(report) {
  return path.join(report.target, ".workflow-state", "plans", "workspace-map.json");
}

function defaultWorkspaceSummaryPath(report) {
  return path.join(report.target, ".planning", "workspace.md");
}

function buildWorkspaceMap(report) {
  return {
    target: report.target,
    kind: report.signals.workspace.kind,
    repoCount: report.signals.workspace.repoCount,
    repos: report.signals.workspace.repos,
    canonicalPolicy: report.signals.workspace.canonicalPolicy,
  };
}

function writeWorkspaceMapOutput(report, options = {}) {
  const outputPath = options.output ? path.resolve(options.output) : defaultWorkspaceMapPath(report);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(buildWorkspaceMap(report), null, 2)}\n`);
  return outputPath;
}

function yesNo(value) {
  return value ? "yes" : "no";
}

function renderWorkspaceSummary(report) {
  const workspace = report.signals.workspace;
  const rows = workspace.repos
    .map((repo) => {
      const surfaces = repo.surfaces;
      return `| \`${repo.relativePath}\` | ${repo.branch || "unknown"} | ${yesNo(repo.dirty)} | ${yesNo(surfaces.hasAdr)} | ${yesNo(surfaces.hasAgentDocs)} | ${yesNo(surfaces.hasReferenceDocs)} | ${yesNo(surfaces.hasGithub)} |`;
    })
    .join("\n");

  return `<!-- GENERATED BY SINAN: workspace-map v1 START -->
# Workspace Map

Target: \`${report.target}\`
Kind: \`${workspace.kind}\`
Nested repos: ${workspace.repoCount}

| Repo | Branch | Dirty | ADRs | Agent Docs | Reference Docs | GitHub |
| --- | --- | --- | --- | --- | --- | --- |
${rows || "| _none_ | - | - | - | - | - | - |"}

## Canonical Policy

- Workspace \`.planning/\` is for cross-repo brainstorms, plans, reviews, campaigns, and handoffs.
- Workspace \`.workflow-state/\` is for generated workspace maps, bootstrap reports, and run state.
- Repo-specific ADRs stay in each child repo's \`docs/adr/\`.
- Workspace \`docs/adr/\` is only for decisions that affect more than one repo.
- Child \`docs/agents/\`, \`docs/reference/\`, \`.github/\`, \`AGENTS.md\`, and \`CLAUDE.md\` are repo-canonical surfaces when present.
- Avoid child \`.planning/\` unless the child repo is being operated as an independent workspace.

<!-- GENERATED BY SINAN: workspace-map v1 END -->
`;
}

function writeWorkspaceSummaryOutput(report, options = {}) {
  const outputPath = options.output ? path.resolve(options.output) : defaultWorkspaceSummaryPath(report);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, renderWorkspaceSummary(report), "utf8");
  return outputPath;
}

function printText(report) {
  console.log("bootstrap report");
  console.log(`target: ${report.target}`);
  console.log(`state: ${report.state}`);
  console.log(`workspace kind: ${report.signals.workspace.kind}`);
  if (report.signals.workspace.repoCount > 0) {
    console.log(`nested repos: ${report.signals.workspace.repos.map((repo) => repo.relativePath).join(", ")}`);
  }
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
  if (args.persist && report.signals.workspace.repoCount > 0) {
    report.workspaceMapPath = defaultWorkspaceMapPath(report);
    report.workspaceSummaryPath = defaultWorkspaceSummaryPath(report);
  }
  if (args.persist || args.output) {
    report.planPath = writePlanOutput(report, args);
  }
  if (args.persist && report.signals.workspace.repoCount > 0) {
    writeWorkspaceMapOutput(report, { output: report.workspaceMapPath });
    writeWorkspaceSummaryOutput(report, { output: report.workspaceSummaryPath });
  }
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
  buildWorkspaceMap,
  buildReport,
  buildPlan,
  classifyState,
  recommendSteps,
  writePlanOutput,
  writeWorkspaceMapOutput,
  writeWorkspaceSummaryOutput,
};

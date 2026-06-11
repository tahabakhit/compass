"use strict";

const fs = require("node:fs");
const path = require("node:path");
const childProcess = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");

function readStdin() {
  return fs.readFileSync(0, "utf8");
}

function parseInput(source) {
  const trimmed = String(source || "").trim();
  if (!trimmed) return {};
  try {
    return JSON.parse(trimmed);
  } catch (error) {
    return {
      parseError: error.message,
      rawInput: trimmed.slice(0, 4000),
    };
  }
}

function printResult(result) {
  if (result === null || result === undefined || result === "") return;
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

function runHook(handler) {
  try {
    const result = handler(parseInput(readStdin()));
    printResult(result);
  } catch (error) {
    process.stderr.write(`Sinan hook error: ${error.message}\n`);
    process.exitCode = 1;
  }
}

function additionalContextOutput(hookEventName, additionalContext, extra = {}) {
  if (!additionalContext) return null;
  return {
    hookSpecificOutput: {
      hookEventName,
      additionalContext,
      ...extra,
    },
  };
}

function shellQuote(value) {
  const text = String(value);
  if (/^[A-Za-z0-9_./:@%+=,-]+$/.test(text)) return text;
  return `'${text.replace(/'/g, "'\\''")}'`;
}

function sinanCliCommand() {
  const python = process.env.PYTHON || "python3";
  return `${shellQuote(python)} ${shellQuote(path.join(ROOT, "scripts", "sinan", "run.py"))}`;
}

function safeCwd(value) {
  const cwd = value || process.cwd();
  return path.resolve(cwd);
}

function runGit(cwd, args) {
  try {
    return childProcess.execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 1500,
    }).trim();
  } catch {
    return "";
  }
}

function repoSnapshot(input = {}) {
  const cwd = safeCwd(input.cwd || input.workspace || input.projectRoot);
  const branch = runGit(cwd, ["branch", "--show-current"]);
  const status = runGit(cwd, ["status", "--short"]);
  const topLevel = runGit(cwd, ["rev-parse", "--show-toplevel"]);

  return {
    cwd,
    repoRoot: topLevel || null,
    git: {
      branch,
      dirty: Boolean(status),
      summary: status.split("\n").filter(Boolean).slice(0, 12),
    },
  };
}

function extractPrompt(input = {}) {
  return (
    input.prompt ||
    input.userPrompt ||
    input.message ||
    input.payload?.prompt ||
    input.payload?.userPrompt ||
    input.transcript?.at?.(-1)?.content ||
    ""
  );
}

function extractCommand(input = {}) {
  return (
    input.command ||
    input.toolInput?.command ||
    input.tool_input?.command ||
    input.payload?.command ||
    input.payload?.toolInput?.command ||
    ""
  );
}

function extractWrite(input = {}) {
  const toolName =
    input.tool_name || input.toolName || input.tool || input.payload?.tool_name || input.payload?.toolName || "";
  const toolInput =
    input.toolInput || input.tool_input || input.payload?.toolInput || input.payload?.tool_input || input;
  const paths = [];
  const direct =
    toolInput.file_path || toolInput.filePath || toolInput.path || input.file_path || input.filePath || input.path;
  if (direct) paths.push(String(direct));
  // Best-effort for Codex apply_patch style bodies (no structured file_path field).
  const patch = toolInput.input || toolInput.patch || input.patch;
  if (patch && typeof patch === "string") {
    const re = /^\*\*\*\s+(?:Add|Update|Delete) File:\s+(.+)$/gm;
    let match;
    while ((match = re.exec(patch))) {
      paths.push(match[1].trim());
    }
  }
  return { toolName, paths };
}

function isMeaningfulWork(input = {}) {
  if (input.meaningfulWork === true) return true;
  if (input.meaningfulWork === false) return false;
  if (Array.isArray(input.changedFiles) && input.changedFiles.length > 0) return true;
  if (Array.isArray(input.testsRun) && input.testsRun.length > 0) return true;
  if (input.route && input.route.taskSize && input.route.taskSize !== "micro") return true;
  return false;
}

module.exports = {
  ROOT,
  additionalContextOutput,
  extractCommand,
  extractPrompt,
  extractWrite,
  isMeaningfulWork,
  parseInput,
  printResult,
  repoSnapshot,
  runHook,
  safeCwd,
  shellQuote,
  sinanCliCommand,
};

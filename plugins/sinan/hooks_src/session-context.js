#!/usr/bin/env node
"use strict";

const { additionalContextOutput, repoSnapshot, runHook, sinanCliCommand } = require("./hook-runtime");

function sessionContext(input = {}) {
  const snapshot = repoSnapshot(input);
  const lines = [
    "Sinan startup context:",
    `- cwd: ${snapshot.cwd}`,
    `- repoRoot: ${snapshot.repoRoot || "unknown"}`,
    `- branch: ${snapshot.git.branch || "unknown"}`,
    `- dirty: ${snapshot.git.dirty ? "yes" : "no"}`,
    `- sinanCli: ${sinanCliCommand()}`,
    "- guidance: keep startup context light; use workflows only when route size justifies them.",
    "- cli guidance: use sinanCli for Sinan CLI operations from any cwd; do not run python3 -m scripts.sinan.cli inside target repos.",
  ];
  if (snapshot.git.summary.length > 0) lines.push(`- changed files: ${snapshot.git.summary.join("; ")}`);
  return additionalContextOutput("SessionStart", lines.join("\n"));
}

if (require.main === module) {
  runHook(sessionContext);
}

module.exports = {
  sessionContext,
};

#!/usr/bin/env node
"use strict";

const { additionalContextOutput, repoSnapshot, runHook } = require("./hook-runtime");

function sessionContext(input = {}) {
  const snapshot = repoSnapshot(input);
  const lines = [
    "Sinan startup context:",
    `- cwd: ${snapshot.cwd}`,
    `- repoRoot: ${snapshot.repoRoot || "unknown"}`,
    `- branch: ${snapshot.git.branch || "unknown"}`,
    `- dirty: ${snapshot.git.dirty ? "yes" : "no"}`,
    "- guidance: keep startup context light; use workflows only when route size justifies them.",
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

#!/usr/bin/env node
"use strict";

const { additionalContextOutput, isMeaningfulWork, repoSnapshot, runHook } = require("./hook-runtime");

function stopHandoff(input = {}) {
  if (!isMeaningfulWork(input)) return null;

  const snapshot = repoSnapshot(input);
  const changedFiles = Array.isArray(input.changedFiles) ? input.changedFiles.slice(0, 20) : snapshot.git.summary;
  const testsRun = Array.isArray(input.testsRun) ? input.testsRun.slice(0, 10) : [];
  const nextSteps = Array.isArray(input.nextSteps) ? input.nextSteps.slice(0, 10) : [];
  const summary = input.summary || "Meaningful work completed; preserve state for continuation.";
  const text = [
    "Sinan handoff:",
    `- summary: ${summary}`,
    `- workflow: ${input.route?.workflow || "unknown"}`,
    `- changedFiles: ${changedFiles.length > 0 ? changedFiles.join("; ") : "none"}`,
    `- testsRun: ${testsRun.length > 0 ? testsRun.join("; ") : "none"}`,
    `- nextSteps: ${nextSteps.length > 0 ? nextSteps.join("; ") : "none"}`,
  ].join("\n");
  return additionalContextOutput("Stop", text);
}

if (require.main === module) {
  runHook(stopHandoff);
}

module.exports = {
  stopHandoff,
};

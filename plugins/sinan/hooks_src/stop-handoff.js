#!/usr/bin/env node
"use strict";

const { isMeaningfulWork, repoSnapshot, runHook } = require("./hook-runtime");

function stopHandoff(input = {}) {
  if (!isMeaningfulWork(input)) {
    return {
      action: "continue",
      hook: "stop-handoff",
      handoff: null,
      reason: "No meaningful work detected.",
    };
  }

  const snapshot = repoSnapshot(input);
  const changedFiles = Array.isArray(input.changedFiles) ? input.changedFiles.slice(0, 20) : snapshot.git.summary;
  const testsRun = Array.isArray(input.testsRun) ? input.testsRun.slice(0, 10) : [];

  return {
    action: "continue",
    hook: "stop-handoff",
    handoff: {
      summary: input.summary || "Meaningful work completed; preserve state for continuation.",
      route: input.route || null,
      changedFiles,
      testsRun,
      nextSteps: Array.isArray(input.nextSteps) ? input.nextSteps.slice(0, 10) : [],
    },
  };
}

if (require.main === module) {
  runHook(stopHandoff);
}

module.exports = {
  stopHandoff,
};

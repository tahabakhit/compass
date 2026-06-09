#!/usr/bin/env node
"use strict";

const { repoSnapshot, runHook } = require("./hook-runtime");

function sessionContext(input = {}) {
  const snapshot = repoSnapshot(input);
  return {
    action: "continue",
    hook: "session-context",
    context: {
      ...snapshot,
      guidance: [
        "Keep startup context lightweight.",
        "Use workflows only when route size justifies them.",
        "Treat old Sinan source as read-only evidence unless explicitly asked.",
      ],
    },
  };
}

if (require.main === module) {
  runHook(sessionContext);
}

module.exports = {
  sessionContext,
};

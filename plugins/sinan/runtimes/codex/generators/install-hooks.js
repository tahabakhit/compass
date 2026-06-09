'use strict';

const {
  mergeHookMaps,
  quoteNodeCommand,
  readJson,
  writeJson,
} = require('../../../core/hooks/install');

const CODEX_EVENTS = new Set([
  'SessionStart',
  'PreToolUse',
  'PermissionRequest',
  'PostToolUse',
  'PreCompact',
  'PostCompact',
  'UserPromptSubmit',
  'SubagentStart',
  'SubagentStop',
  'Stop',
]);

const EVENT_MAP = {
  SessionStart: 'SessionStart',
  PreToolUse: 'PreToolUse',
  PermissionRequest: 'PermissionRequest',
  PostToolUse: 'PostToolUse',
  PostToolUseFailure: null,
  PreCompact: 'PreCompact',
  PostCompact: 'PostCompact',
  Stop: 'Stop',
  StopFailure: null,
  SessionEnd: 'Stop',
  SubagentStart: 'SubagentStart',
  SubagentStop: 'SubagentStop',
  TaskCreated: null,
  TaskCompleted: null,
  WorktreeCreate: null,
  WorktreeRemove: null,
};

function extractHookName(command) {
  const match = command.match(/hooks_src\/([^.]+)\.js/);
  return match ? match[1] : null;
}

function translateCodexHooks(hooksTemplate, adapterScriptPath, options = {}) {
  const codexHooks = {};
  const warnings = [];
  const installed = [];
  const skipped = [];
  const adapterPath = adapterScriptPath.replace(/\\/g, '/');
  const adapterCmd = quoteNodeCommand(`node ${adapterPath}`);
  const commandForHook = options.commandForHook || ((hookName) => `${adapterCmd} ${hookName}`);
  const commandWindowsForHook = options.commandWindowsForHook || null;

  for (const [sinanEvent, entries] of Object.entries(hooksTemplate.hooks || {})) {
    const codexEvent = EVENT_MAP[sinanEvent];

    if (!codexEvent) {
      for (const entry of entries) {
        for (const hook of entry.hooks || []) {
          const name = extractHookName(hook.command);
          if (name) skipped.push({ hook: name, event: sinanEvent, reason: 'no Codex equivalent' });
        }
      }
      warnings.push(`${sinanEvent}: no Codex equivalent (${entries.length} hook(s) skipped)`);
      continue;
    }

    if (!codexHooks[codexEvent]) codexHooks[codexEvent] = [];

    for (const entry of entries) {
      if (!entry.hooks) continue;

      const hooks = [];
      for (const hook of entry.hooks) {
        const hookName = extractHookName(hook.command);
        if (!hookName) continue;
        const translatedHook = {
          type: 'command',
          command: commandForHook(hookName),
          statusMessage: `Sinan: ${hookName}`,
          timeout: hook.timeout || 30,
        };
        if (commandWindowsForHook) translatedHook.commandWindows = commandWindowsForHook(hookName);
        hooks.push(translatedHook);
        installed.push({ hook: hookName, event: codexEvent });
      }

      if (hooks.length === 0) continue;

      // Expand pipe-delimited matchers into separate entries (e.g. "Edit|Write" → two entries)
      const matchers = entry.matcher ? entry.matcher.split('|').map((m) => m.trim()).filter(Boolean) : [null];
      for (const matcher of matchers) {
        const codexEntry = { hooks };
        if (matcher) codexEntry.matcher = matcher;
        codexHooks[codexEvent].push(codexEntry);
      }
    }
  }

  return { hooks: codexHooks, installed, skipped, warnings };
}

function translateCodexPluginHooks(hooksTemplate) {
  const adapter = '${PLUGIN_ROOT}/hooks_src/codex-adapter.js';
  return translateCodexHooks(hooksTemplate, adapter, {
    commandForHook: (hookName) => `sh -lc 'root="\${PLUGIN_ROOT:-\${CLAUDE_PLUGIN_ROOT:-}}"; if [ -z "$root" ]; then root="$PWD"; fi; exec node "$root/hooks_src/codex-adapter.js" "$1"' sh ${hookName}`,
    commandWindowsForHook: (hookName) => `node "%PLUGIN_ROOT%\\hooks_src\\codex-adapter.js" ${hookName}`,
  });
}

function installCodexHooks(options = {}) {
  const existingHooks = options.existingHooks || {};
  const translated = translateCodexHooks(options.hooksTemplate, options.adapterScriptPath);
  const mergedHooks = mergeHookMaps({
    existingHooks,
    generatedHooks: translated.hooks,
    preserveMarker: 'codex-adapter',
  });

  const filteredHooks = Object.fromEntries(
    Object.entries(mergedHooks).filter(([event]) => CODEX_EVENTS.has(event))
  );

  if (options.outputPath) {
    writeJson(options.outputPath, { hooks: filteredHooks });
  }

  return {
    ...translated,
    hooks: filteredHooks,
  };
}

module.exports = {
  CODEX_EVENTS,
  EVENT_MAP,
  extractHookName,
  installCodexHooks,
  translateCodexPluginHooks,
  translateCodexHooks,
};

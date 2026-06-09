'use strict';

const fs = require('fs');
const path = require('path');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readJson(filePath, fallback = {}) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(filePath, data) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n');
}

function quoteNodeCommand(command) {
  return command.replace(/^node\s+(.+)$/, (_match, script) => {
    if (script.includes(' ') && !script.startsWith('"')) return `node "${script}"`;
    return `node ${script}`;
  });
}

function isCitadelHookEntry(entry, marker) {
  if (!entry.hooks) return false;
  return entry.hooks.some(hook => hook.command && hook.command.includes(marker));
}

function mergeHookMaps({ existingHooks = {}, generatedHooks = {}, preserveMarker }) {
  const merged = {};
  const allEvents = new Set([...Object.keys(existingHooks), ...Object.keys(generatedHooks)]);

  for (const event of allEvents) {
    const currentEntries = existingHooks[event] || [];
    const generatedEntries = generatedHooks[event] || [];
    const preservedEntries = currentEntries.filter(entry => !isCitadelHookEntry(entry, preserveMarker));

    if (generatedEntries.length > 0 || preservedEntries.length > 0) {
      merged[event] = [...generatedEntries, ...preservedEntries];
    }
  }

  return merged;
}

function countGeneratedEntries(hooks) {
  return Object.values(hooks).reduce((sum, entries) => sum + entries.length, 0);
}

function countPreservedHooks(hooks, preserveMarker) {
  return Object.values(hooks).reduce((sum, entries) => {
    return sum + entries.filter(entry => !isCitadelHookEntry(entry, preserveMarker)).length;
  }, 0);
}

module.exports = {
  countGeneratedEntries,
  countPreservedHooks,
  ensureDir,
  mergeHookMaps,
  quoteNodeCommand,
  readJson,
  writeJson,
};

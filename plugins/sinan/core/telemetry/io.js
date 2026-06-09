'use strict';

const fs = require('fs');
const path = require('path');

function ensureParentDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function appendJsonl(filePath, entry) {
  ensureParentDir(filePath);
  fs.appendFileSync(filePath, JSON.stringify(entry) + '\n');
}

function readJsonlDetailed(filePath, options = {}) {
  const { validator = null } = options;

  if (!fs.existsSync(filePath)) {
    return {
      file: filePath,
      exists: false,
      entries: [],
      invalidCount: 0,
      invalidLines: [],
      lineCount: 0,
    };
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = raw.split(/\r?\n/).filter(Boolean);
  const entries = [];
  const invalidLines = [];

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    let parsed = null;

    try {
      parsed = JSON.parse(line);
    } catch (error) {
      invalidLines.push({
        lineNumber: index + 1,
        reason: `invalid JSON: ${error.message}`,
        raw: line,
      });
      continue;
    }

    if (typeof validator === 'function') {
      const result = validator(parsed);
      if (!result.valid) {
        invalidLines.push({
          lineNumber: index + 1,
          reason: result.errors.join('; '),
          raw: line,
        });
        continue;
      }
    }

    entries.push(parsed);
  }

  return {
    file: filePath,
    exists: true,
    entries,
    invalidCount: invalidLines.length,
    invalidLines,
    lineCount: lines.length,
  };
}

function readJsonl(filePath, options = {}) {
  return readJsonlDetailed(filePath, options).entries;
}

module.exports = {
  appendJsonl,
  ensureParentDir,
  readJsonl,
  readJsonlDetailed,
};

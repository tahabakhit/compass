'use strict';

function parseHandoff(text) {
  const match = text.match(/---\s*HANDOFF\s*---\s*\n([\s\S]*?)(?:\n---|\Z)/i);
  if (!match) {
    return { found: false, items: [], raw: '' };
  }

  const raw = match[1].trim();
  const items = raw.split('\n')
    .map(line => line.replace(/^[-*]\s*/, '').trim())
    .filter(Boolean);

  return { found: true, items, raw };
}

module.exports = {
  parseHandoff,
};

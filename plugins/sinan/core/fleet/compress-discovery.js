'use strict';

const fs = require('fs');
const path = require('path');
const { parseHandoff } = require('./parse-handoff');

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const key = argv[i];
    const val = argv[i + 1];
    if (key === '--input') { args.input = val; i++; }
    else if (key === '--output') { args.output = val; i++; }
    else if (key === '--session') { args.session = val; i++; }
    else if (key === '--agent') { args.agent = val; i++; }
    else if (key === '--wave') { args.wave = parseInt(val, 10); i++; }
    else if (key === '--status') { args.status = val; i++; }
  }
  return args;
}

function extractDecisions(text) {
  const decisions = [];
  for (const line of text.split('\n')) {
    if (/\b(decided|decision|chose|chosen|picked)\b/i.test(line) && line.length < 200) {
      decisions.push(line.replace(/^[-*]\s*/, '').trim());
    }
  }
  return decisions.slice(0, 5);
}

function extractFiles(text) {
  const files = new Set();
  const filePatterns = text.match(/(?:src|lib|app|pages|components|api|test|spec)\/[\w\-./]+\.\w+/g);
  if (filePatterns) {
    for (const file of filePatterns) files.add(file);
  }
  return [...files].slice(0, 10);
}

function extractFailures(text) {
  const failures = [];
  for (const line of text.split('\n')) {
    if (/\b(failed|error|broke|broken|couldn't|cannot|blocked)\b/i.test(line) && line.length < 200) {
      failures.push(line.replace(/^[-*]\s*/, '').trim());
    }
  }
  return failures.slice(0, 3);
}

function compressDiscovery(rawText, agentName, status) {
  const handoff = parseHandoff(rawText);
  const decisions = extractDecisions(rawText);
  const files = extractFiles(rawText);
  const failures = extractFailures(rawText);

  const lines = [`## Agent: ${agentName || 'unknown'}`];
  lines.push(`**Status:** ${status || (failures.length > 0 ? 'partial' : 'complete')}`);

  if (handoff.found && handoff.items.length > 0) {
    lines.push(`**Built:** ${handoff.items.slice(0, 2).join('. ')}`);
    if (handoff.items.length > 2) {
      lines.push(`**Remaining:** ${handoff.items.slice(2).join('; ')}`);
    }
  }

  if (decisions.length > 0) {
    lines.push('**Decisions:**');
    for (const decision of decisions) lines.push(`- ${decision}`);
  }

  if (failures.length > 0) {
    lines.push('**Failures:**');
    for (const failure of failures) lines.push(`- ${failure}`);
  }

  if (files.length > 0) {
    lines.push(`**Files:** ${files.join(', ')}`);
  }

  return lines.join('\n');
}

function logCompressionStat(projectRoot, entry) {
  const statsFile = path.join(projectRoot, '.planning', 'telemetry', 'compression-stats.jsonl');
  const dir = path.dirname(statsFile);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(statsFile, JSON.stringify(entry) + '\n');
  return statsFile;
}

module.exports = {
  compressDiscovery,
  extractDecisions,
  extractFailures,
  extractFiles,
  logCompressionStat,
  parseArgs,
};

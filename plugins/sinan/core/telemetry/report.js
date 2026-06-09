'use strict';

const { readJsonlDetailed } = require('./io');
const { resolveTelemetryPaths } = require('./log');
const { validateAgentRunEvent, validateHookTimingEvent } = require('./schema');

function summarizeInvalid(data) {
  if (!data.invalidCount) return null;
  return `${data.invalidCount} invalid line${data.invalidCount === 1 ? '' : 's'} skipped`;
}

function buildAgentReport(projectRoot, options = {}) {
  const { limit = null } = options;
  const paths = resolveTelemetryPaths(projectRoot);
  const data = readJsonlDetailed(paths.agentRuns, { validator: validateAgentRunEvent });
  const relevant = limit ? data.entries.slice(-limit) : data.entries;
  const counts = {};
  const completedDurations = [];

  for (const entry of relevant) {
    counts[entry.event] = (counts[entry.event] || 0) + 1;
    if (typeof entry.duration_ms === 'number' && (entry.event === 'agent-complete' || entry.event === 'agent-fail')) {
      completedDurations.push(entry.duration_ms);
    }
  }

  const recentRuns = relevant
    .filter(entry => entry.event === 'agent-complete' || entry.event === 'agent-fail')
    .slice(-10)
    .map(entry => ({
      timestamp: entry.timestamp,
      agent: entry.agent,
      status: entry.status || entry.event,
      duration_ms: entry.duration_ms,
    }));

  const averageDurationMs = completedDurations.length > 0
    ? completedDurations.reduce((sum, value) => sum + value, 0) / completedDurations.length
    : null;

  return {
    kind: 'agent',
    totalEntries: data.entries.length,
    visibleEntries: relevant.length,
    counts,
    recentRuns,
    averageDurationMs,
    invalidCount: data.invalidCount,
    invalidSummary: summarizeInvalid(data),
  };
}

function buildHookReport(projectRoot) {
  const paths = resolveTelemetryPaths(projectRoot);
  const data = readJsonlDetailed(paths.hookTiming, { validator: validateHookTimingEvent });
  const byHook = {};

  for (const entry of data.entries) {
    const key = entry.hook || 'unknown';
    if (!byHook[key]) {
      byHook[key] = { count: 0, totalMs: 0, averageMs: null, metrics: {} };
    }

    const bucket = byHook[key];
    bucket.count += 1;
    if (typeof entry.duration_ms === 'number') {
      bucket.totalMs += entry.duration_ms;
    }
    if (entry.metric) {
      bucket.metrics[entry.metric] = (bucket.metrics[entry.metric] || 0) + 1;
    }
  }

  for (const hook of Object.keys(byHook)) {
    const bucket = byHook[hook];
    bucket.averageMs = bucket.totalMs > 0 ? bucket.totalMs / bucket.count : null;
  }

  return {
    kind: 'hook',
    totalEntries: data.entries.length,
    hooks: byHook,
    invalidCount: data.invalidCount,
    invalidSummary: summarizeInvalid(data),
  };
}

function buildCompressionReport(projectRoot) {
  const paths = resolveTelemetryPaths(projectRoot);
  const data = readJsonlDetailed(paths.compression);
  let totalInput = 0;
  let totalOutput = 0;

  for (const entry of data.entries) {
    totalInput += entry.inputChars || 0;
    totalOutput += entry.outputChars || 0;
  }

  const averageRatio = totalInput > 0 ? totalOutput / totalInput : 0;
  const recent = data.entries.slice(-5).map(entry => ({
    agent: entry.agent || '?',
    inputChars: entry.inputChars || 0,
    outputChars: entry.outputChars || 0,
    ratio: typeof entry.ratio === 'number'
      ? entry.ratio
      : ((entry.inputChars || 0) > 0 ? (entry.outputChars || 0) / entry.inputChars : 0),
  }));

  return {
    kind: 'compression',
    totalEntries: data.entries.length,
    totalInput,
    totalOutput,
    averageRatio,
    recent,
    invalidCount: data.invalidCount,
    invalidSummary: summarizeInvalid(data),
  };
}

function formatAgentReport(report) {
  if (report.visibleEntries === 0) return 'No agent runs recorded yet.\n';

  const lines = [
    '',
    '=== Agent Run Summary ===',
    '',
  ];

  for (const [event, count] of Object.entries(report.counts)) {
    lines.push(`  ${event}: ${count}`);
  }

  if (report.averageDurationMs !== null) {
    lines.push(`  average terminal duration: ${(report.averageDurationMs / 1000).toFixed(1)}s`);
  }

  lines.push('', '--- Recent Runs ---', '');

  for (const entry of report.recentRuns) {
    const duration = typeof entry.duration_ms === 'number'
      ? `${(entry.duration_ms / 1000).toFixed(1)}s`
      : '?';
    lines.push(`  ${entry.timestamp.slice(0, 16)} | ${entry.agent} | ${entry.status} | ${duration}`);
  }

  lines.push('', `Total entries: ${report.totalEntries}`);

  if (report.invalidSummary) {
    lines.push(`Invalid lines: ${report.invalidSummary}`);
  }

  return lines.join('\n') + '\n';
}

function formatHookReport(report) {
  if (report.totalEntries === 0) return 'No hook timing data recorded yet.\n';

  const lines = [
    '',
    '=== Hook Timing Summary ===',
    '',
  ];

  for (const [hook, data] of Object.entries(report.hooks)) {
    const avg = data.averageMs !== null ? ` avg ${data.averageMs.toFixed(0)}ms` : '';
    lines.push(`  ${hook}: ${data.count} events${avg}`);
    for (const [metric, count] of Object.entries(data.metrics)) {
      lines.push(`    ${metric}: ${count}`);
    }
  }

  if (report.invalidSummary) {
    lines.push('', `Invalid lines: ${report.invalidSummary}`);
  }

  return lines.join('\n') + '\n';
}

function formatCompressionReport(report) {
  if (report.totalEntries === 0) return 'No compression stats recorded yet.\n';

  const lines = [
    '',
    '=== Discovery Compression Stats ===',
    '',
    `  Compressions: ${report.totalEntries}`,
    `  Total input: ${report.totalInput} chars`,
    `  Total output: ${report.totalOutput} chars`,
    `  Average ratio: ${(report.averageRatio * 100).toFixed(1)}%`,
    '',
    '--- Recent ---',
    '',
  ];

  for (const entry of report.recent) {
    lines.push(`  ${entry.agent}: ${entry.inputChars} → ${entry.outputChars} chars (${(entry.ratio * 100).toFixed(1)}%)`);
  }

  if (report.invalidSummary) {
    lines.push('', `Invalid lines: ${report.invalidSummary}`);
  }

  return lines.join('\n') + '\n';
}

module.exports = {
  buildAgentReport,
  buildCompressionReport,
  buildHookReport,
  formatAgentReport,
  formatCompressionReport,
  formatHookReport,
};

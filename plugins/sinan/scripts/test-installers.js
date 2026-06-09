#!/usr/bin/env node

'use strict';

const assert = require('assert');
const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const CITADEL_ROOT = path.resolve(__dirname, '..');

function tempProject(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function runJson(args, cwd = CITADEL_ROOT) {
  const output = execFileSync(process.execPath, args, {
    cwd,
    encoding: 'utf8',
    stdio: 'pipe',
    timeout: 30000,
  });
  return JSON.parse(output);
}

function testUnharnessRefusesPluginRoot() {
  const planningPath = path.join(CITADEL_ROOT, '.planning');
  const result = spawnSync(process.execPath, [
    path.join(CITADEL_ROOT, 'scripts', 'unharness.js'),
    CITADEL_ROOT,
  ], {
    cwd: CITADEL_ROOT,
    encoding: 'utf8',
    timeout: 30000,
  });
  assert.notEqual(result.status, 0, 'unharness should refuse the Sinan plugin root');
  assert(String(result.stderr || '').includes('unharness cannot run against the Sinan plugin repo itself'));
  assert(fs.existsSync(planningPath), '.planning must remain after refused unharness');
}

function write(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function testUnharnessRemovesProjectHarness() {
  const tmp = tempProject('citadel-unharness-');
  try {
    write(path.join(tmp, '.planning', 'research', 'note.md'), '# Note\n');
    write(path.join(tmp, '.citadel', 'plugin-root.txt'), CITADEL_ROOT);
    write(path.join(tmp, '.claude', 'agent-context', 'README.md'), 'agent context\n');
    write(path.join(tmp, '.claude', 'settings.json'), JSON.stringify({
      hooks: {
        PreToolUse: [
          { command: `node ${path.join(CITADEL_ROOT, 'hooks_src', 'protect-files.js')}` },
          { command: 'node user-hook.js' },
        ],
      },
    }, null, 2));

    const result = spawnSync(process.execPath, [
      path.join(CITADEL_ROOT, 'scripts', 'unharness.js'),
      tmp,
    ], {
      cwd: tmp,
      encoding: 'utf8',
      timeout: 30000,
    });

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert(!fs.existsSync(path.join(tmp, '.planning')), '.planning should be removed');
    assert(!fs.existsSync(path.join(tmp, '.citadel')), '.citadel should be removed');
    assert(fs.existsSync(path.join(tmp, 'docs', 'citadel', 'research.md')), 'research archive should be written');

    const settings = JSON.parse(fs.readFileSync(path.join(tmp, '.claude', 'settings.json'), 'utf8'));
    const settingsText = JSON.stringify(settings);
    assert(settingsText.includes('node user-hook.js'), 'user hook should be preserved');
    assert(!settingsText.includes('protect-files.js'), 'Sinan hook should be removed');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

function testClaudeDryRun() {
  const tmp = tempProject('citadel-claude-install-');
  try {
    const report = runJson([
      path.join(CITADEL_ROOT, 'scripts', 'claude-install.js'),
      '--project-root',
      tmp,
      '--install',
      '--scope',
      'local',
      '--dry-run',
      '--json',
    ]);
    assert(report.pass, JSON.stringify(report, null, 2));
    assert.equal(report.scope, 'local');
    assert(report.steps.some((step) => step.name === 'Validate Claude Code plugin marketplace'));
    assert(report.steps.some((step) => step.name === 'Register Sinan marketplace with Claude Code'));
    assert(report.steps.some((step) => step.name === 'Install Sinan plugin'));
    assert(report.steps.some((step) => step.name === 'Install resolved Sinan hooks'));
    assert(report.steps.every((step) => step.skipped));
    assert(report.nextSteps.claudeCode.some((step) => step.includes('/do --list')));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

function testUnifiedDispatcherDryRun() {
  const tmp = tempProject('sinan-install-');
  try {
    const codex = runJson([
      path.join(CITADEL_ROOT, 'scripts', 'install.js'),
      '--runtime',
      'codex',
      '--project-root',
      tmp,
      '--plugin-only',
      '--dry-run',
      '--json',
    ]);
    assert.equal(codex.mode, 'plugin-only');
    assert(codex.pass, JSON.stringify(codex, null, 2));

    const claude = runJson([
      path.join(CITADEL_ROOT, 'scripts', 'install.js'),
      '--runtime',
      'claude',
      '--project-root',
      tmp,
      '--install',
      '--dry-run',
      '--json',
    ]);
    assert.equal(claude.scope, 'local');
    assert(claude.pass, JSON.stringify(claude, null, 2));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

function testClaudeMarketplaceManifest() {
  const marketplacePath = path.join(CITADEL_ROOT, '.claude-plugin', 'marketplace.json');
  const pluginPath = path.join(CITADEL_ROOT, '.claude-plugin', 'plugin.json');
  const marketplace = JSON.parse(fs.readFileSync(marketplacePath, 'utf8'));
  const plugin = JSON.parse(fs.readFileSync(pluginPath, 'utf8'));
  assert.equal(marketplace.plugins[0].version, plugin.version, 'Claude marketplace version should match plugin.json');
  assert(!marketplace.plugins[0].description.includes('â'), 'Claude marketplace description should not contain mojibake');
}

testUnharnessRefusesPluginRoot();
testUnharnessRemovesProjectHarness();
testClaudeDryRun();
testUnifiedDispatcherDryRun();
testClaudeMarketplaceManifest();

console.log('installer tests passed');

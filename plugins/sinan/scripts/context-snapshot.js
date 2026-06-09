#!/usr/bin/env node
'use strict';

/**
 * Build a cheap repo-local context snapshot for the current project.
 *
 * This borrows the useful part of Superpowers Optimized's context engine while
 * keeping Sinan's state model: generated state lives under .planning/ and
 * the script is capped so session-start hooks stay cheap.
 */

const { createHash } = require('crypto');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const MAX_BLAST_FILES = Number(process.env.CITADEL_CONTEXT_MAX_FILES || 12);
const TIMEOUT_MS = Number(process.env.CITADEL_CONTEXT_TIMEOUT_MS || 5000);
const BASENAME_DENYLIST = new Set([
  'index',
  'main',
  'test',
  'tests',
  'spec',
  'utils',
  'util',
  'helpers',
  'helper',
  'config',
  'setup',
  'app',
  'types',
  'constants',
  'common',
  'shared',
  'lib',
  'mod',
]);

function parseArgs(argv) {
  const args = {
    projectRoot: process.env.CLAUDE_PROJECT_DIR || process.cwd(),
    json: false,
    quiet: false,
  };

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === '--project-root') args.projectRoot = path.resolve(argv[++index] || '.');
    else if (arg === '--json') args.json = true;
    else if (arg === '--quiet') args.quiet = true;
  }

  return args;
}

function runGit(projectRoot, args) {
  try {
    return execFileSync('git', args, {
      cwd: projectRoot,
      encoding: 'utf8',
      timeout: TIMEOUT_MS,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
}

function gitList(projectRoot, args) {
  const output = runGit(projectRoot, args);
  return output ? output.split('\n').map((line) => line.trim()).filter(Boolean) : [];
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function safeBasename(file) {
  const base = path.basename(file, path.extname(file));
  if (base.length < 3) return '';
  if (BASENAME_DENYLIST.has(base.toLowerCase())) return '';
  return base.replace(/[^a-zA-Z0-9_-]/g, '');
}

function changedFiles(projectRoot, hasHead) {
  if (!hasHead) {
    const tracked = gitList(projectRoot, ['ls-files', '--modified', '--others', '--exclude-standard']);
    return [...new Set(tracked)];
  }

  const fromHead = gitList(projectRoot, ['diff', '--name-only', 'HEAD']);
  const staged = gitList(projectRoot, ['diff', '--cached', '--name-only']);
  const untracked = gitList(projectRoot, ['ls-files', '--others', '--exclude-standard']);
  return [...new Set([...fromHead, ...staged, ...untracked])];
}

function crossSession(projectRoot, planningDir, head) {
  const stateDir = path.join(planningDir, 'context');
  ensureDir(stateDir);

  const key = createHash('sha1').update(projectRoot).digest('hex').slice(0, 12);
  const watermarkPath = path.join(stateDir, `last-head-${key}.txt`);
  const lastHead = fs.existsSync(watermarkPath)
    ? fs.readFileSync(watermarkPath, 'utf8').trim()
    : '';

  const result = {
    last_head: lastHead || null,
    files: [],
    commit_count: 0,
  };

  if (lastHead && head && lastHead !== head) {
    const mergeBase = runGit(projectRoot, ['merge-base', lastHead, head]);
    if (mergeBase === lastHead) {
      result.files = gitList(projectRoot, ['diff', '--name-only', `${lastHead}..${head}`]);
      result.commit_count = gitList(projectRoot, ['log', '--oneline', `${lastHead}..${head}`]).length;
    }
  }

  if (head) fs.writeFileSync(watermarkPath, head);
  return result;
}

function blastRadius(projectRoot, files) {
  const radius = {};

  for (const file of files.slice(0, MAX_BLAST_FILES)) {
    const safeName = safeBasename(file);
    if (!safeName) continue;

    const refs = gitList(projectRoot, [
      'grep',
      '-l',
      safeName,
      '--',
      ':(exclude)*.lock',
      ':(exclude)package-lock.json',
      ':(exclude)*.min.js',
      ':(exclude)*.map',
    ]);

    radius[file] = refs
      .filter((ref) => ref !== file)
      .filter((ref) => {
        const lines = runGit(projectRoot, ['grep', '-h', safeName, '--', ref]);
        if (!lines) return true;
        return [
          new RegExp(`(import|require|from).*${safeName}`, 'i'),
          new RegExp(`[./]${safeName}[./'";\`]`),
        ].some((pattern) => pattern.test(lines));
      })
      .slice(0, 25);
  }

  return radius;
}

function ensureKnownIssues(planningDir) {
  const target = path.join(planningDir, 'known-issues.md');
  if (fs.existsSync(target)) return;

  fs.writeFileSync(target, [
    '# Known Issues',
    '',
    'Record recurring failure signatures and verified fixes here.',
    '',
    '## Template',
    '',
    '- **Symptom:**',
    '  **Cause:**',
    '  **Fix:**',
    '  **Evidence:**',
    '',
  ].join('\n'));
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const projectRoot = path.resolve(args.projectRoot);
  const insideWorkTree = runGit(projectRoot, ['rev-parse', '--is-inside-work-tree']);

  if (insideWorkTree !== 'true') {
    if (args.json) process.stdout.write(JSON.stringify({ status: 'skipped', reason: 'not-git-repo' }, null, 2));
    else if (!args.quiet) process.stdout.write('[context-snapshot] skipped: not a git repository\n');
    return;
  }

  const planningDir = path.join(projectRoot, '.planning');
  ensureDir(planningDir);
  ensureDir(path.join(planningDir, 'context'));
  ensureKnownIssues(planningDir);

  const hasHead = Boolean(runGit(projectRoot, ['rev-parse', '--verify', 'HEAD']));
  const head = hasHead ? runGit(projectRoot, ['rev-parse', 'HEAD']) : '';
  const files = changedFiles(projectRoot, hasHead);
  const snapshot = {
    generated_at: new Date().toISOString(),
    project_root: projectRoot,
    git_hash: head || null,
    branch: runGit(projectRoot, ['branch', '--show-current']) || null,
    changed_files: files,
    change_stat: hasHead ? runGit(projectRoot, ['diff', '--stat', 'HEAD']) : '',
    recent_commits: hasHead ? gitList(projectRoot, ['log', '--oneline', '-5']) : [],
    cross_session: crossSession(projectRoot, planningDir, head),
    blast_radius: blastRadius(projectRoot, files),
    known_issues_path: '.planning/known-issues.md',
  };

  const snapshotPath = path.join(planningDir, 'context-snapshot.json');
  fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2));

  if (args.json) {
    process.stdout.write(JSON.stringify(snapshot, null, 2));
  } else if (!args.quiet) {
    const refs = Object.values(snapshot.blast_radius).reduce((sum, list) => sum + list.length, 0);
    process.stdout.write(`[context-snapshot] wrote .planning/context-snapshot.json (${files.length} changed, ${refs} refs)\n`);
  }
}

main();

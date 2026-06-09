'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const STALE_INSTANCE_MS = 2 * 60 * 60 * 1000;

function getProjectRoot(projectRoot) {
  return projectRoot || process.env.CLAUDE_PROJECT_DIR || process.cwd();
}

function getCoordinationPaths(projectRoot) {
  const root = getProjectRoot(projectRoot);
  const coordinationDir = path.join(root, '.planning', 'coordination');
  return {
    root,
    coordinationDir,
    instancesDir: path.join(coordinationDir, 'instances'),
    claimsDir: path.join(coordinationDir, 'claims'),
  };
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function writeJsonAtomic(filePath, data) {
  const tmp = `${filePath}.tmp.${process.pid}`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, filePath);
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function listJsonFiles(dir) {
  ensureDir(dir);
  return fs.readdirSync(dir)
    .filter(file => file.endsWith('.json') && !file.startsWith('.'))
    .map(file => ({
      name: file,
      path: path.join(dir, file),
      data: readJson(path.join(dir, file)),
    }))
    .filter(file => file.data !== null);
}

function removeFileIfExists(filePath) {
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function generateInstanceId() {
  return `agent-${crypto.randomBytes(4).toString('hex')}`;
}

module.exports = {
  STALE_INSTANCE_MS,
  ensureDir,
  generateInstanceId,
  getCoordinationPaths,
  isProcessAlive,
  listJsonFiles,
  readJson,
  removeFileIfExists,
  writeJsonAtomic,
};

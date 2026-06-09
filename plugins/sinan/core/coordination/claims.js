'use strict';

const path = require('path');
const {
  ensureDir,
  getCoordinationPaths,
  listJsonFiles,
  removeFileIfExists,
  writeJsonAtomic,
} = require('./io');

function normalizeScopeEntry(entry) {
  return String(entry || '').replace(/\(read-only\)$/u, '').trim();
}

function isReadOnlyScope(entry) {
  return String(entry || '').trim().endsWith('(read-only)');
}

function scopesOverlap(scopeA, scopeB) {
  for (const left of scopeA) {
    if (isReadOnlyScope(left)) continue;
    const cleanLeft = normalizeScopeEntry(left);

    for (const right of scopeB) {
      if (isReadOnlyScope(right)) continue;
      const cleanRight = normalizeScopeEntry(right);
      if (cleanLeft.startsWith(cleanRight) || cleanRight.startsWith(cleanLeft)) {
        return true;
      }
    }
  }

  return false;
}

function listClaims(options = {}) {
  const paths = getCoordinationPaths(options.projectRoot);
  return listJsonFiles(paths.claimsDir);
}

function findOverlap(scope, options = {}) {
  for (const existing of listClaims(options)) {
    if (options.excludeInstanceId && existing.data.instanceId === options.excludeInstanceId) continue;
    if (scopesOverlap(scope, existing.data.scope || [])) return existing.data;
  }
  return null;
}

function claimScope(id, scope, type, description, options = {}) {
  const paths = getCoordinationPaths(options.projectRoot);
  ensureDir(paths.claimsDir);

  const overlap = findOverlap(scope, { ...options, excludeInstanceId: id });
  if (overlap) {
    const error = new Error(`Scope overlap with ${overlap.instanceId}: ${(overlap.scope || []).join(', ')}`);
    error.code = 'SCOPE_OVERLAP';
    error.overlap = overlap;
    throw error;
  }

  const now = options.now ? new Date(options.now) : new Date();
  const data = {
    instanceId: id,
    type: type || 'unknown',
    scope,
    description: description || '',
    claimedAt: now.toISOString(),
  };

  writeJsonAtomic(path.join(paths.claimsDir, `${id}.json`), data);
  return data;
}

function releaseClaim(id, options = {}) {
  const paths = getCoordinationPaths(options.projectRoot);
  const file = path.join(paths.claimsDir, `${id}.json`);
  const existed = require('./io').readJson(file);
  removeFileIfExists(file);
  return existed;
}

function getClaimStatus(options = {}) {
  return {
    claims: listClaims(options).map(entry => entry.data),
  };
}

module.exports = {
  claimScope,
  findOverlap,
  getClaimStatus,
  listClaims,
  releaseClaim,
  scopesOverlap,
};

'use strict';

const path = require('path');
const {
  STALE_INSTANCE_MS,
  getCoordinationPaths,
  isProcessAlive,
  removeFileIfExists,
} = require('./io');
const { listInstances } = require('./instances');

function sweepStaleInstances(options = {}) {
  const nowMs = options.nowMs || Date.now();
  const paths = getCoordinationPaths(options.projectRoot);
  const swept = [];

  for (const instance of listInstances(options)) {
    const lastSeenMs = new Date(instance.data.lastSeen).getTime();
    const stale = Number.isFinite(lastSeenMs) && (nowMs - lastSeenMs) > STALE_INSTANCE_MS;
    const dead = instance.data.pid && !isProcessAlive(instance.data.pid);

    if (!stale && !dead) continue;

    removeFileIfExists(instance.path);
    removeFileIfExists(path.join(paths.claimsDir, instance.name));

    swept.push({
      instanceId: instance.data.instanceId,
      reason: dead ? 'dead process' : 'stale',
    });
  }

  return {
    cleaned: swept.length,
    swept,
  };
}

module.exports = {
  sweepStaleInstances,
};

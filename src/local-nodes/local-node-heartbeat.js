'use strict';

const store = require('./local-node-store');

function recordHeartbeat(nodeId, data) {
  if (!nodeId) return { ok: false, error: 'Missing nodeId' };
  const node = store.getNode(nodeId);
  if (!node) return { ok: false, error: 'Node not found' };
  const entry = {
    nodeId,
    status: (data && data.status) || 'alive',
    metrics: (data && data.metrics) || {},
    timestamp: new Date().toISOString()
  };
  store.setHeartbeat(nodeId, entry);
  store.setNode(nodeId, { ...node, lastSeenAt: entry.timestamp, status: 'connected' });
  return { ok: true, heartbeat: entry };
}

function getLastHeartbeat(nodeId) {
  return store.getHeartbeat(nodeId);
}

function checkHeartbeatFreshness(nodeId, maxAgeMs) {
  const hb = store.getHeartbeat(nodeId);
  if (!hb) return { fresh: false, reason: 'no_heartbeat' };
  const age = Date.now() - new Date(hb.timestamp).getTime();
  return { fresh: age <= (maxAgeMs || 60000), ageMs: age, lastAt: hb.timestamp };
}

function listHeartbeats() {
  return store.listNodes().map(n => store.getHeartbeat(n.id)).filter(Boolean);
}

function detectStaleNodes(maxAgeMs) {
  const threshold = maxAgeMs || 120000;
  const nodes = store.listNodes();
  const stale = [];
  for (const node of nodes) {
    const hb = store.getHeartbeat(node.id);
    if (!hb) {
      stale.push({ nodeId: node.id, reason: 'no_heartbeat' });
      continue;
    }
    const age = Date.now() - new Date(hb.timestamp).getTime();
    if (age > threshold) stale.push({ nodeId: node.id, ageMs: age, lastAt: hb.timestamp });
  }
  return stale;
}

module.exports = {
  recordHeartbeat, getLastHeartbeat, checkHeartbeatFreshness,
  listHeartbeats, detectStaleNodes
};

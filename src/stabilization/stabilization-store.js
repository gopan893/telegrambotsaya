'use strict';

const STORE = new Map();

function _key(workspaceId) {
  return `v1-lock:${workspaceId || 'default'}`;
}

function getV1FinalLock(workspaceId) {
  return STORE.get(_key(workspaceId)) || null;
}

function setV1FinalLock(lock, workspaceId) {
  const key = _key(workspaceId);
  const existing = STORE.get(key);
  const updated = { ...(existing || {}), ...lock, id: key, updatedAt: new Date().toISOString() };
  if (!existing) updated.createdAt = new Date().toISOString();
  STORE.set(key, updated);
  return updated;
}

function listV1FinalLocks() {
  const results = [];
  for (const [key, value] of STORE.entries()) {
    if (key.startsWith('v1-lock:')) results.push(value);
  }
  return results;
}

function clearV1FinalLock(workspaceId) {
  STORE.delete(_key(workspaceId));
}

module.exports = { getV1FinalLock, setV1FinalLock, listV1FinalLocks, clearV1FinalLock };

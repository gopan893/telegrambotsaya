'use strict';

const store = require('./local-node-store');

function registerNode(params) {
  if (!params || !params.id || !params.type) {
    return { ok: false, error: 'Missing node id or type' };
  }
  const node = {
    id: params.id,
    type: params.type,
    name: params.name || params.id,
    status: params.status || 'registered',
    host: params.host || 'localhost',
    port: params.port || 0,
    capabilities: Array.isArray(params.capabilities) ? params.capabilities : [],
    metadata: params.metadata || {},
    registeredAt: new Date().toISOString(),
    lastSeenAt: null
  };
  store.setNode(params.id, node);
  return { ok: true, node };
}

function getNode(nodeId) {
  return store.getNode(nodeId);
}

function updateNode(nodeId, updates) {
  const existing = store.getNode(nodeId);
  if (!existing) return { ok: false, error: 'Node not found' };
  const updated = { ...existing, ...updates, id: nodeId, lastSeenAt: new Date().toISOString() };
  store.setNode(nodeId, updated);
  return { ok: true, node: updated };
}

function removeNode(nodeId) {
  return store.removeNode(nodeId);
}

function listNodes(filter) {
  return store.listNodes(filter);
}

function getNodesByType(type) {
  return store.listNodes({ type });
}

function getNodeCount() {
  return store.listNodes().length;
}

function resetStore() {
  store.resetStore();
}

module.exports = {
  registerNode, getNode, updateNode, removeNode,
  listNodes, getNodesByType, getNodeCount, resetStore
};

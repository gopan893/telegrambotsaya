'use strict';

const store = {
  nodes: new Map(),
  handshakes: new Map(),
  heartbeats: new Map(),
  healthRecords: new Map(),
  capabilities: new Map(),
  messageContracts: new Map(),
  safetyBoundaries: new Map(),
  reports: new Map()
};

function getNode(nodeId) {
  return store.nodes.get(String(nodeId)) || null;
}

function setNode(nodeId, data) {
  store.nodes.set(String(nodeId), { ...data, id: nodeId, updatedAt: new Date().toISOString() });
  return getNode(nodeId);
}

function removeNode(nodeId) {
  return store.nodes.delete(String(nodeId));
}

function listNodes(filter) {
  let arr = Array.from(store.nodes.values());
  if (filter) {
    if (filter.status) arr = arr.filter(n => n.status === filter.status);
    if (filter.type) arr = arr.filter(n => n.type === filter.type);
    if (filter.workspaceId) arr = arr.filter(n => n.workspaceId === filter.workspaceId);
  }
  return arr;
}

function getHandshake(handshakeId) {
  return store.handshakes.get(String(handshakeId)) || null;
}

function setHandshake(handshakeId, data) {
  store.handshakes.set(String(handshakeId), { ...data, id: handshakeId, updatedAt: new Date().toISOString() });
  return getHandshake(handshakeId);
}

function listHandshakes(filter) {
  let arr = Array.from(store.handshakes.values());
  if (filter) {
    if (filter.status) arr = arr.filter(h => h.status === filter.status);
    if (filter.nodeId) arr = arr.filter(h => h.nodeId === filter.nodeId);
  }
  return arr;
}

function getHeartbeat(nodeId) {
  return store.heartbeats.get(String(nodeId)) || null;
}

function setHeartbeat(nodeId, data) {
  store.heartbeats.set(String(nodeId), { ...data, nodeId, updatedAt: new Date().toISOString() });
  return getHeartbeat(nodeId);
}

function getHealthRecord(nodeId) {
  return store.healthRecords.get(String(nodeId)) || null;
}

function setHealthRecord(nodeId, data) {
  store.healthRecords.set(String(nodeId), { ...data, nodeId, updatedAt: new Date().toISOString() });
  return getHealthRecord(nodeId);
}

function getCapability(nodeId) {
  return store.capabilities.get(String(nodeId)) || null;
}

function setCapability(nodeId, data) {
  store.capabilities.set(String(nodeId), { ...data, nodeId, updatedAt: new Date().toISOString() });
  return getCapability(nodeId);
}

function getMessageContract(contractId) {
  return store.messageContracts.get(String(contractId)) || null;
}

function setMessageContract(contractId, data) {
  store.messageContracts.set(String(contractId), { ...data, id: contractId, updatedAt: new Date().toISOString() });
  return getMessageContract(contractId);
}

function listMessageContracts(filter) {
  let arr = Array.from(store.messageContracts.values());
  if (filter) {
    if (filter.nodeId) arr = arr.filter(c => c.nodeId === filter.nodeId);
    if (filter.status) arr = arr.filter(c => c.status === filter.status);
  }
  return arr;
}

function getSafetyBoundary(nodeId) {
  return store.safetyBoundaries.get(String(nodeId)) || null;
}

function setSafetyBoundary(nodeId, data) {
  store.safetyBoundaries.set(String(nodeId), { ...data, nodeId, updatedAt: new Date().toISOString() });
  return getSafetyBoundary(nodeId);
}

function getReport(reportId) {
  return store.reports.get(String(reportId)) || null;
}

function setReport(reportId, data) {
  store.reports.set(String(reportId), { ...data, id: reportId, createdAt: new Date().toISOString() });
  return getReport(reportId);
}

function listReports() {
  return Array.from(store.reports.values()).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
}

function getStats() {
  return {
    nodes: store.nodes.size,
    handshakes: store.handshakes.size,
    heartbeats: store.heartbeats.size,
    healthRecords: store.healthRecords.size,
    capabilities: store.capabilities.size,
    messageContracts: store.messageContracts.size,
    safetyBoundaries: store.safetyBoundaries.size,
    reports: store.reports.size
  };
}

function resetStore() {
  for (const map of Object.values(store)) {
    map.clear();
  }
}

module.exports = {
  getNode, setNode, removeNode, listNodes,
  getHandshake, setHandshake, listHandshakes,
  getHeartbeat, setHeartbeat,
  getHealthRecord, setHealthRecord,
  getCapability, setCapability,
  getMessageContract, setMessageContract, listMessageContracts,
  getSafetyBoundary, setSafetyBoundary,
  getReport, setReport, listReports,
  getStats, resetStore
};

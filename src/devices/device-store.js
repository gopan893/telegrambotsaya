'use strict';

const store = {
  devices: new Map(),
  pairings: new Map(),
  healthRecords: new Map(),
  capabilities: new Map(),
  risks: new Map(),
  actionPlans: new Map(),
  simulations: new Map(),
  proposals: new Map(),
  auditLog: new Map(),
  reports: new Map()
};

function getDevice(deviceId) {
  return store.devices.get(String(deviceId)) || null;
}

function setDevice(deviceId, data) {
  store.devices.set(String(deviceId), { ...data, id: deviceId, updatedAt: new Date().toISOString() });
  return getDevice(deviceId);
}

function removeDevice(deviceId) {
  return store.devices.delete(String(deviceId));
}

function listDevices(filter) {
  let arr = Array.from(store.devices.values());
  if (filter) {
    if (filter.status) arr = arr.filter(d => d.status === filter.status);
    if (filter.type) arr = arr.filter(d => d.type === filter.type);
    if (filter.workspaceId) arr = arr.filter(d => d.workspaceId === filter.workspaceId);
    if (filter.trustLevel) arr = arr.filter(d => d.trustLevel === filter.trustLevel);
  }
  return arr;
}

function getPairing(pairingId) {
  return store.pairings.get(String(pairingId)) || null;
}

function setPairing(pairingId, data) {
  store.pairings.set(String(pairingId), { ...data, id: pairingId, updatedAt: new Date().toISOString() });
  return getPairing(pairingId);
}

function listPairings(filter) {
  let arr = Array.from(store.pairings.values());
  if (filter) {
    if (filter.status) arr = arr.filter(p => p.status === filter.status);
    if (filter.deviceId) arr = arr.filter(p => p.deviceId === filter.deviceId);
  }
  return arr;
}

function getHealthRecord(deviceId) {
  return store.healthRecords.get(String(deviceId)) || null;
}

function setHealthRecord(deviceId, data) {
  store.healthRecords.set(String(deviceId), { ...data, deviceId, updatedAt: new Date().toISOString() });
  return getHealthRecord(deviceId);
}

function getCapability(deviceId) {
  return store.capabilities.get(String(deviceId)) || null;
}

function setCapability(deviceId, data) {
  store.capabilities.set(String(deviceId), { ...data, deviceId, updatedAt: new Date().toISOString() });
  return getCapability(deviceId);
}

function getRiskProfile(deviceId) {
  return store.risks.get(String(deviceId)) || null;
}

function setRiskProfile(deviceId, data) {
  store.risks.set(String(deviceId), { ...data, deviceId, updatedAt: new Date().toISOString() });
  return getRiskProfile(deviceId);
}

function getActionPlan(planId) {
  return store.actionPlans.get(String(planId)) || null;
}

function setActionPlan(planId, data) {
  store.actionPlans.set(String(planId), { ...data, id: planId, createdAt: new Date().toISOString() });
  return getActionPlan(planId);
}

function listActionPlans(filter) {
  let arr = Array.from(store.actionPlans.values());
  if (filter) {
    if (filter.deviceId) arr = arr.filter(p => p.deviceId === filter.deviceId);
    if (filter.status) arr = arr.filter(p => p.status === filter.status);
  }
  return arr;
}

function getSimulation(simId) {
  return store.simulations.get(String(simId)) || null;
}

function setSimulation(simId, data) {
  store.simulations.set(String(simId), { ...data, id: simId, createdAt: new Date().toISOString() });
  return getSimulation(simId);
}

function getProposal(proposalId) {
  return store.proposals.get(String(proposalId)) || null;
}

function setProposal(proposalId, data) {
  store.proposals.set(String(proposalId), { ...data, id: proposalId, createdAt: new Date().toISOString() });
  return getProposal(proposalId);
}

function listProposals(filter) {
  let arr = Array.from(store.proposals.values());
  if (filter) {
    if (filter.deviceId) arr = arr.filter(p => p.deviceId === filter.deviceId);
    if (filter.status) arr = arr.filter(p => p.status === filter.status);
  }
  return arr;
}

function addAuditEvent(eventId, data) {
  store.auditLog.set(String(eventId), { ...data, id: eventId, createdAt: new Date().toISOString() });
}

function listAuditEvents(filter) {
  let arr = Array.from(store.auditLog.values());
  if (filter) {
    if (filter.deviceId) arr = arr.filter(e => e.deviceId === filter.deviceId);
    if (filter.eventType) arr = arr.filter(e => e.eventType === filter.eventType);
  }
  return arr.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
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
    devices: store.devices.size,
    pairings: store.pairings.size,
    healthRecords: store.healthRecords.size,
    capabilities: store.capabilities.size,
    risks: store.risks.size,
    actionPlans: store.actionPlans.size,
    simulations: store.simulations.size,
    proposals: store.proposals.size,
    auditEvents: store.auditLog.size,
    reports: store.reports.size
  };
}

function resetStore() {
  for (const map of Object.values(store)) {
    map.clear();
  }
}

module.exports = {
  getDevice, setDevice, removeDevice, listDevices,
  getPairing, setPairing, listPairings,
  getHealthRecord, setHealthRecord,
  getCapability, setCapability,
  getRiskProfile, setRiskProfile,
  getActionPlan, setActionPlan, listActionPlans,
  getSimulation, setSimulation,
  getProposal, setProposal, listProposals,
  addAuditEvent, listAuditEvents,
  getReport, setReport, listReports,
  getStats, resetStore
};

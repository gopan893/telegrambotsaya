'use strict';

const GATES = new Map();
const DECISIONS = new Map();

function _gateKey(workspaceId) {
  return `v2-gate:${workspaceId || 'default'}`;
}

function _decisionsKey(workspaceId) {
  return `v2-decisions:${workspaceId || 'default'}`;
}

function getV2PlanningGate(workspaceId) {
  return GATES.get(_gateKey(workspaceId)) || null;
}

function setV2PlanningGate(gate, workspaceId) {
  const key = _gateKey(workspaceId);
  const existing = GATES.get(key);
  const updated = { ...(existing || {}), ...gate, id: key, updatedAt: new Date().toISOString() };
  if (!existing) updated.createdAt = new Date().toISOString();
  GATES.set(key, updated);
  return updated;
}

function listV2PlanningGates() {
  const results = [];
  for (const [key, value] of GATES.entries()) {
    if (key.startsWith('v2-gate:')) results.push(value);
  }
  return results;
}

function clearV2PlanningGate(workspaceId) {
  GATES.delete(_gateKey(workspaceId));
}

function recordV2Decision(decision, workspaceId) {
  const key = _decisionsKey(workspaceId);
  const list = DECISIONS.get(key) || [];
  const entry = { ...decision, id: decision.id || `d-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, recordedAt: decision.recordedAt || new Date().toISOString() };
  list.push(entry);
  DECISIONS.set(key, list);
  return entry;
}

function listV2Decisions(workspaceId) {
  return DECISIONS.get(_decisionsKey(workspaceId)) || [];
}

function summarizeV2Decisions(workspaceId) {
  const decisions = listV2Decisions(workspaceId);
  const total = decisions.length;
  const byType = {};
  for (const d of decisions) {
    byType[d.type] = (byType[d.type] || 0) + 1;
  }
  return { total, byType, decisions };
}

module.exports = { getV2PlanningGate, setV2PlanningGate, listV2PlanningGates, clearV2PlanningGate, recordV2Decision, listV2Decisions, summarizeV2Decisions };

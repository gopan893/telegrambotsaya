'use strict';

const store = require('./v2-planning-store');

async function recordV2Decision(decision, services) {
  if (!decision || !decision.type || !decision.description) {
    return { passed: false, result: null, reason: 'Decision must have type and description.', score: 0 };
  }
  const entry = {
    type: decision.type,
    description: decision.description,
    reason: decision.reason || '',
    recordedBy: decision.recordedBy || 'system',
    recordedAt: new Date().toISOString()
  };
  const saved = store.recordV2Decision(entry, services?.workspaceId);
  return { passed: true, result: saved, score: 100 };
}

async function listV2Decisions(filters, services) {
  const all = store.listV2Decisions(services?.workspaceId);
  if (!filters) return { passed: true, data: all, count: all.length, score: 100 };
  let filtered = [...all];
  if (filters.type) filtered = filtered.filter(d => d.type === filters.type);
  if (filters.recordedBy) filtered = filtered.filter(d => d.recordedBy === filters.recordedBy);
  if (filters.since) filtered = filtered.filter(d => new Date(d.recordedAt) >= new Date(filters.since));
  if (filters.until) filtered = filtered.filter(d => new Date(d.recordedAt) <= new Date(filters.until));
  return { passed: true, data: filtered, count: filtered.length, score: 100 };
}

async function summarizeV2Decisions(services) {
  const summary = store.summarizeV2Decisions(services?.workspaceId);
  return { passed: true, data: summary, score: 100 };
}

module.exports = { recordV2Decision, listV2Decisions, summarizeV2Decisions };

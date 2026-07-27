'use strict';

const crypto = require('crypto');
const POLICIES = [];

const DEFAULTS = {
  telegram_session_context: { retentionDays: 30, archiveAfterDays: 7, deleteAfterDays: 30, hardDeleteAllowed: false, requiresApprovalForDelete: true, defaultAction: 'archive' },
  audit_logs: { retentionDays: 180, archiveAfterDays: 90, deleteAfterDays: 365, hardDeleteAllowed: false, requiresApprovalForDelete: true, defaultAction: 'keep' },
  security_findings: { retentionDays: 365, archiveAfterDays: 180, deleteAfterDays: 0, hardDeleteAllowed: false, requiresApprovalForDelete: true, defaultAction: 'keep' },
  incident_reports: { retentionDays: 365, archiveAfterDays: 180, deleteAfterDays: 0, hardDeleteAllowed: false, requiresApprovalForDelete: true, defaultAction: 'keep' },
  deploy_reports: { retentionDays: 365, archiveAfterDays: 180, deleteAfterDays: 730, hardDeleteAllowed: false, requiresApprovalForDelete: true, defaultAction: 'archive' },
  cost_usage: { retentionDays: 365, archiveAfterDays: 180, deleteAfterDays: 0, hardDeleteAllowed: false, requiresApprovalForDelete: true, defaultAction: 'keep' },
  lifeos_mood_energy: { retentionDays: 90, archiveAfterDays: 30, deleteAfterDays: 180, hardDeleteAllowed: false, requiresApprovalForDelete: true, defaultAction: 'archive' },
  lessons_learned: { retentionDays: 730, archiveAfterDays: 365, deleteAfterDays: 0, hardDeleteAllowed: false, requiresApprovalForDelete: true, defaultAction: 'keep' },
  improvement_feedback: { retentionDays: 180, archiveAfterDays: 90, deleteAfterDays: 365, hardDeleteAllowed: false, requiresApprovalForDelete: true, defaultAction: 'archive' }
};

function getRetentionPolicy(category) {
  const existing = POLICIES.find(p => p.dataCategory === category);
  if (existing) return existing;
  return DEFAULTS[category] || { retentionDays: 90, archiveAfterDays: 30, deleteAfterDays: 180, hardDeleteAllowed: false, requiresApprovalForDelete: true, defaultAction: 'keep' };
}

function updateRetentionPolicy(policy) {
  const idx = POLICIES.findIndex(p => p.dataCategory === policy.dataCategory);
  if (idx >= 0) { POLICIES[idx] = { ...POLICIES[idx], ...policy, updatedAt: new Date().toISOString() }; return POLICIES[idx]; }
  const entry = { ...policy, id: crypto.createHash('sha1').update(`rp:${Date.now()}:${Math.random()}`).digest('hex').slice(0, 16), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  POLICIES.push(entry); return entry;
}

function findRetentionCandidates() {
  return Object.keys(DEFAULTS).map(cat => ({ category: cat, policy: getRetentionPolicy(cat), staleCount: Math.floor(Math.random() * 50) }));
}

function createRetentionActionPlan(candidates) {
  return { id: crypto.createHash('sha1').update(`rap:${Date.now()}`).digest('hex').slice(0, 16), candidates: (candidates || []).map(c => ({ category: c.category, action: c.policy?.defaultAction || 'keep', count: c.staleCount || 0 })), createdAt: new Date().toISOString() };
}

function validateRetentionPolicy(policy) {
  const issues = [];
  if (!policy.retentionDays || policy.retentionDays < 1) issues.push('retentionDays must be >= 1');
  if (policy.hardDeleteAllowed && policy.requiresApprovalForDelete !== true) issues.push('Hard delete always requires approval');
  return { valid: issues.length === 0, issues };
}

function listPolicies() { return [...POLICIES]; }

module.exports = { getRetentionPolicy, updateRetentionPolicy, findRetentionCandidates, createRetentionActionPlan, validateRetentionPolicy, listPolicies };

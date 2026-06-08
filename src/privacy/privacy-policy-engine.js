'use strict';

const POLICIES = [];

function getPrivacyPolicy(category) {
  const existing = POLICIES.find(p => p.dataCategory === category);
  if (existing) return existing;
  const defaults = {
    telegram_messages: { allowedRoles: ['owner', 'admin'], ownerOnly: false, allowAgentAccess: true, allowCodingAgentAccess: false, allowDashboardAccess: true, allowTelegramSummary: true, allowExport: false, allowArchive: true, allowDeleteRequest: true },
    lifeos_mood_energy: { allowedRoles: ['owner'], ownerOnly: true, allowAgentAccess: false, allowCodingAgentAccess: false, allowDashboardAccess: false, allowTelegramSummary: false, allowExport: false, allowArchive: true, allowDeleteRequest: true },
    lifeos_tasks: { allowedRoles: ['owner', 'admin'], ownerOnly: false, allowAgentAccess: true, allowCodingAgentAccess: false, allowDashboardAccess: true, allowTelegramSummary: true, allowExport: true, allowArchive: true, allowDeleteRequest: true },
    personal_goals: { allowedRoles: ['owner', 'admin'], ownerOnly: false, allowAgentAccess: true, allowCodingAgentAccess: false, allowDashboardAccess: true, allowTelegramSummary: true, allowExport: true, allowArchive: true, allowDeleteRequest: true },
    security_findings: { allowedRoles: ['owner', 'admin'], ownerOnly: false, allowAgentAccess: false, allowCodingAgentAccess: false, allowDashboardAccess: true, allowTelegramSummary: false, allowExport: false, allowArchive: true, allowDeleteRequest: false },
    audit_logs: { allowedRoles: ['owner', 'admin'], ownerOnly: false, allowAgentAccess: false, allowCodingAgentAccess: false, allowDashboardAccess: true, allowTelegramSummary: false, allowExport: false, allowArchive: true, allowDeleteRequest: false }
  };
  return defaults[category] || { allowedRoles: ['owner', 'admin', 'user'], ownerOnly: false, allowAgentAccess: true, allowCodingAgentAccess: true, allowDashboardAccess: true, allowTelegramSummary: true, allowExport: true, allowArchive: true, allowDeleteRequest: true };
}

function updatePrivacyPolicy(policy) {
  const idx = POLICIES.findIndex(p => p.dataCategory === policy.dataCategory);
  if (idx >= 0) { POLICIES[idx] = { ...POLICIES[idx], ...policy, updatedAt: new Date().toISOString() }; return POLICIES[idx]; }
  const entry = { ...policy, id: require('crypto').createHash('sha1').update(`pp:${Date.now()}:${Math.random()}`).digest('hex').slice(0, 16), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  POLICIES.push(entry); return entry;
}

function evaluatePrivacyAccess(request) {
  const { actor, dataCategory, action } = request || {};
  if (!actor) return { allowed: false, reason: 'Unknown actor' };
  const policy = getPrivacyPolicy(dataCategory);
  if (policy.ownerOnly && actor.role !== 'owner') return { allowed: false, reason: 'Owner-only data' };
  if (!policy.allowedRoles.includes(actor.role)) return { allowed: false, reason: `Role ${actor.role} not allowed for ${dataCategory}` };
  if (action === 'export' && !policy.allowExport) return { allowed: false, reason: 'Export not allowed' };
  if (action === 'archive' && !policy.allowArchive) return { allowed: false, reason: 'Archive not allowed' };
  if (action === 'delete' && !policy.allowDeleteRequest) return { allowed: false, reason: 'Delete not allowed' };
  return { allowed: true, reason: 'Access granted' };
}

function enforcePrivacyPolicy(request) {
  return evaluatePrivacyAccess(request);
}

function buildPrivacyDecision(request) {
  const result = evaluatePrivacyAccess(request);
  return { request: { actor: request?.actor?.role, dataCategory: request?.dataCategory, action: request?.action }, allowed: result.allowed, reason: result.reason, timestamp: new Date().toISOString() };
}

function listPolicies() { return [...POLICIES]; }

module.exports = { getPrivacyPolicy, updatePrivacyPolicy, evaluatePrivacyAccess, enforcePrivacyPolicy, buildPrivacyDecision, listPolicies };

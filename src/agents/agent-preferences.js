'use strict';

const profileStore = require('./agent-profile-store');
const {
  assertNoSecretLike,
  auditAgentMemory,
  normalizeAgentId,
  normalizeWorkspaceId,
  nowIso,
  sanitizeSummary
} = require('./agent-memory-utils');

const BLOCKED_KEYS = [
  'canExecuteWithoutApproval',
  'executeWithoutApproval',
  'bypassApproval',
  'disableSecurity',
  'shell',
  'arbitraryCode',
  'token',
  'secret',
  'apiKey',
  'databaseUrl',
  'redisUrl'
];

function sanitizePreferences(preferences = {}) {
  assertNoSecretLike(preferences);
  const out = {};
  for (const [key, value] of Object.entries(preferences || {})) {
    if (BLOCKED_KEYS.some(blocked => key.toLowerCase().includes(blocked.toLowerCase()))) continue;
    if (typeof value === 'string') out[key] = value.slice(0, 240);
    else if (typeof value === 'number' || typeof value === 'boolean' || value === null) out[key] = value;
    else if (Array.isArray(value)) out[key] = value.slice(0, 20).map(item => String(item).slice(0, 120));
    else if (typeof value === 'object') out[key] = sanitizeSummary(value);
  }
  return sanitizeSummary(out);
}

async function getAgentPreferences(agentId, services = {}) {
  const profile = await profileStore.getAgentProfile(agentId, services);
  return sanitizeSummary({
    agentId: normalizeAgentId(agentId),
    workspaceId: profile.workspaceId || normalizeWorkspaceId(services.workspaceId),
    preferences: profile.preferences || {},
    responseStyle: profile.responseStyle || {},
    memoryPolicy: profile.memoryPolicy || {},
    updatedAt: profile.updatedAt || null
  });
}

async function updateAgentPreferences(agentId, patch = {}, actor = {}, services = {}) {
  const cleanAgentId = normalizeAgentId(agentId);
  const workspaceId = normalizeWorkspaceId(patch.workspaceId || actor.workspaceId || services.workspaceId);
  const nextPreferences = sanitizePreferences(patch.preferences || patch);
  const profile = await profileStore.updateAgentProfile(cleanAgentId, {
    workspaceId,
    preferences: nextPreferences,
    updatedAt: nowIso()
  }, actor, services);
  await auditAgentMemory('agents/preferences_updated', {
    agentId: cleanAgentId,
    workspaceId,
    userId: actor.userId || services.userId || '',
    actorId: actor.actorId || actor.userId || services.actorId || '',
    targetId: cleanAgentId,
    preferences: nextPreferences
  }, services);
  return {
    agentId: cleanAgentId,
    workspaceId,
    preferences: profile.preferences || {},
    updatedAt: profile.updatedAt
  };
}

function mergeRuntimePreferences(profile = {}, runtime = {}) {
  return sanitizeSummary({
    ...(profile.preferences || {}),
    ...(runtime.preferences || {})
  });
}

module.exports = {
  getAgentPreferences,
  mergeRuntimePreferences,
  sanitizePreferences,
  updateAgentPreferences
};

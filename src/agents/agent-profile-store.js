'use strict';

const personality = require('./agent-personality');
const {
  AGENT_PROFILE_OVERRIDES_KEY,
  assertNoSecretLike,
  auditAgentMemory,
  normalizeAgentId,
  normalizeWorkspaceId,
  nowIso,
  safeRead,
  safeWrite,
  sanitizeSummary
} = require('./agent-memory-utils');

async function loadProfileOverrides(services = {}) {
  return await safeRead(AGENT_PROFILE_OVERRIDES_KEY, {}, services);
}

async function saveProfileOverrides(overrides = {}, services = {}) {
  return await safeWrite(AGENT_PROFILE_OVERRIDES_KEY, sanitizeSummary(overrides), services);
}

function getWorkspaceBucket(overrides = {}, workspaceId = 'default') {
  return overrides[workspaceId] || {};
}

async function getAgentProfile(agentId, services = {}) {
  const cleanAgentId = normalizeAgentId(agentId);
  const workspaceId = normalizeWorkspaceId(services.workspaceId || services.context?.workspaceId);
  const defaults = personality.getDefaultAgentProfile(cleanAgentId);
  const overrides = await loadProfileOverrides(services);
  const workspaceOverrides = getWorkspaceBucket(overrides, workspaceId);
  const globalOverrides = getWorkspaceBucket(overrides, 'global');
  const merged = {
    ...defaults,
    ...(globalOverrides[cleanAgentId] || {}),
    ...(workspaceOverrides[cleanAgentId] || {})
  };
  return sanitizeSummary({
    ...merged,
    agentId: cleanAgentId,
    workspaceId,
    responseStyle: { ...(defaults.responseStyle || {}), ...(globalOverrides[cleanAgentId]?.responseStyle || {}), ...(workspaceOverrides[cleanAgentId]?.responseStyle || {}) },
    preferences: { ...(defaults.preferences || {}), ...(globalOverrides[cleanAgentId]?.preferences || {}), ...(workspaceOverrides[cleanAgentId]?.preferences || {}) },
    memoryPolicy: { ...(defaults.memoryPolicy || {}), ...(globalOverrides[cleanAgentId]?.memoryPolicy || {}), ...(workspaceOverrides[cleanAgentId]?.memoryPolicy || {}) },
    updatedAt: merged.updatedAt || nowIso()
  });
}

async function listAgentProfiles(services = {}) {
  const profiles = personality.listDefaultAgentProfiles();
  const output = [];
  for (const profile of profiles) {
    output.push(await getAgentProfile(profile.agentId, services));
  }
  return output;
}

async function updateAgentProfile(agentId, patch = {}, actor = {}, services = {}) {
  const cleanAgentId = normalizeAgentId(agentId);
  const workspaceId = normalizeWorkspaceId(patch.workspaceId || actor.workspaceId || services.workspaceId);
  const sanitizedPatch = personality.sanitizeProfilePatch(patch);
  assertNoSecretLike(sanitizedPatch);

  const overrides = await loadProfileOverrides(services);
  overrides[workspaceId] = overrides[workspaceId] || {};
  const previous = overrides[workspaceId][cleanAgentId] || {};
  const next = sanitizeSummary({
    ...previous,
    ...sanitizedPatch,
    responseStyle: { ...(previous.responseStyle || {}), ...(sanitizedPatch.responseStyle || {}) },
    preferences: { ...(previous.preferences || {}), ...(sanitizedPatch.preferences || {}) },
    memoryPolicy: { ...(previous.memoryPolicy || {}), ...(sanitizedPatch.memoryPolicy || {}) },
    agentId: cleanAgentId,
    workspaceId,
    updatedBy: String(actor.userId || actor.actorId || services.actorId || ''),
    updatedAt: nowIso()
  });
  overrides[workspaceId][cleanAgentId] = next;
  await saveProfileOverrides(overrides, services);
  await auditAgentMemory('agents/profile_updated', {
    agentId: cleanAgentId,
    workspaceId,
    userId: actor.userId || services.userId || '',
    actorId: actor.actorId || actor.userId || services.actorId || '',
    targetId: cleanAgentId,
    patch: sanitizedPatch
  }, services);
  return await getAgentProfile(cleanAgentId, { ...services, workspaceId });
}

async function resetAgentProfile(agentId, options = {}, services = {}) {
  const cleanAgentId = normalizeAgentId(agentId);
  const workspaceId = normalizeWorkspaceId(options.workspaceId || services.workspaceId);
  const overrides = await loadProfileOverrides(services);
  if (overrides[workspaceId]) delete overrides[workspaceId][cleanAgentId];
  await saveProfileOverrides(overrides, services);
  await auditAgentMemory('agents/profile_reset', {
    agentId: cleanAgentId,
    workspaceId,
    userId: options.userId || services.userId || '',
    actorId: options.actorId || options.userId || services.actorId || '',
    targetId: cleanAgentId
  }, services);
  return await getAgentProfile(cleanAgentId, { ...services, workspaceId });
}

module.exports = {
  getAgentProfile,
  listAgentProfiles,
  loadProfileOverrides,
  resetAgentProfile,
  saveProfileOverrides,
  updateAgentProfile
};

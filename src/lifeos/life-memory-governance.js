'use strict';

const store = require('./lifeos-store');
const utils = require('./lifeos-utils');

function classifyLifeMemoryCandidate(input = {}, services = {}) {
  const text = `${input.text || input.title || ''} ${input.description || input.note || ''}`;
  if (utils.containsSecretLike(input)) {
    return { type: 'blocked_secret', sensitivity: 'sensitive', shouldStore: false, reason: 'secret-like content' };
  }
  if (/ingat|remember|fokus|goal|tujuan|rutinitas|habit|belajar/i.test(text)) {
    return { type: 'life_preference', sensitivity: utils.inferSensitivity(input), shouldStore: true, reason: 'explicit memory intent' };
  }
  if (/capek|sedih|cemas|stres|stress|mood|energy/i.test(text)) {
    return { type: 'private_reflection', sensitivity: 'private', shouldStore: true, reason: 'personal mood context' };
  }
  return { type: 'context_note', sensitivity: 'normal', shouldStore: false, reason: 'no explicit memory intent' };
}

function runLifeMemorySafetyGate(candidate = {}, services = {}) {
  if (utils.containsSecretLike(candidate)) {
    return {
      ok: false,
      allowed: false,
      reason: 'SECRET_LIKE_LIFE_MEMORY_BLOCKED',
      sanitizedCandidate: utils.sanitizePayload(candidate)
    };
  }
  return {
    ok: true,
    allowed: true,
    reason: '',
    sanitizedCandidate: utils.sanitizePayload(candidate, { maxString: 800, maxItems: 100, maxKeys: 80 })
  };
}

async function storeSafeLifeMemory(candidate = {}, services = {}) {
  const classification = classifyLifeMemoryCandidate(candidate, services);
  const gate = runLifeMemorySafetyGate({ ...candidate, classification }, services);
  if (!gate.allowed) {
    await utils.auditLife('lifeos/memory_blocked', { workspaceId: utils.resolveWorkspaceId(candidate, services), userId: utils.resolveUserId(candidate, services), status: 'blocked', decision: 'denied', reason: gate.reason, summary: { type: classification.type } }, services);
    return gate;
  }
  if (!classification.shouldStore) return { ok: true, stored: false, classification };
  const item = utils.buildLifeItem({
    type: 'reflection',
    title: candidate.title || 'Life memory',
    description: candidate.text || candidate.description || candidate.note || '',
    sensitivity: classification.sensitivity,
    data: { classification }
  }, services);
  await store.upsertLifeItem(item, services);
  await utils.auditLife('lifeos/memory_stored', { workspaceId: item.workspaceId, userId: item.userId, targetId: item.id, summary: { type: classification.type, sensitivity: item.sensitivity } }, services);
  return { ok: true, stored: true, memory: item, classification };
}

async function retrieveLifeContext(query = '', services = {}) {
  const items = await store.listLifeItems({ workspaceId: services.workspaceId, userId: services.userId, limit: 200 }, services);
  const q = String(query || '').toLowerCase();
  const matches = items
    .filter((item) => ['personal_goal', 'habit', 'reflection', 'mood_note', 'energy_note'].includes(item.type))
    .filter((item) => !q || `${item.title} ${item.description}`.toLowerCase().includes(q))
    .slice(0, 8)
    .map((item) => utils.sanitizePayload({
      id: item.id,
      type: item.type,
      title: item.title,
      sensitivity: item.sensitivity,
      summary: item.sensitivity === 'private' || item.sensitivity === 'sensitive' ? '[PRIVATE_LIFE_CONTEXT]' : item.description
    }));
  return { ok: true, items: matches };
}

async function archiveSensitiveLifeMemory(memoryId, services = {}) {
  const current = await store.getLifeItem(memoryId, services);
  if (!current) return { ok: false, reason: 'LIFE_MEMORY_NOT_FOUND', status: 404 };
  const next = { ...current, status: 'archived', updatedAt: utils.nowIso(), data: { ...(current.data || {}), archivedAt: utils.nowIso() } };
  await store.upsertLifeItem(next, services);
  return { ok: true, memory: next };
}

module.exports = {
  archiveSensitiveLifeMemory,
  classifyLifeMemoryCandidate,
  retrieveLifeContext,
  runLifeMemorySafetyGate,
  storeSafeLifeMemory
};

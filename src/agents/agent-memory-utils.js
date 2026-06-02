'use strict';

const {
  buildSafeText,
  compactText,
  containsSecretLike,
  createId,
  maskSecret,
  normalizeId,
  nowIso,
  safeRead,
  safeWrite,
  sanitizeSummary,
  unique
} = require('./agent-utils');

const AGENT_MEMORIES_KEY = 'agent_memories';
const AGENT_SHARED_MEMORIES_KEY = 'agent_shared_memories';
const AGENT_LEARNING_NOTES_KEY = 'agent_learning_notes';
const AGENT_PROFILE_OVERRIDES_KEY = 'agent_profile_overrides';
const DEFAULT_WORKSPACE_ID = 'default';

const VALID_MEMORY_TYPES = [
  'style_preference',
  'project_context',
  'technical_pattern',
  'risk_pattern',
  'learning_note',
  'decision_note',
  'ops_note',
  'security_note',
  'reflection_note',
  'user_preference',
  'shared_context',
  'correction',
  'lesson'
];

const SECRET_REJECTION_MESSAGE = 'Konten terlihat seperti token/secret/credential, jadi tidak disimpan ke agent memory.';

function normalizeWorkspaceId(value) {
  return String(value || DEFAULT_WORKSPACE_ID).trim() || DEFAULT_WORKSPACE_ID;
}

function normalizeUserId(value) {
  return String(value || '').trim();
}

function normalizeAgentId(value) {
  return normalizeId(value || 'orchestrator') || 'orchestrator';
}

function parseTags(tags) {
  const input = Array.isArray(tags) ? tags : String(tags || '').split(',');
  return unique(input.map(tag => normalizeId(tag)).filter(Boolean)).slice(0, 20);
}

function clampScore(value, fallback = 0.5) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.min(1, number));
}

function sanitizeMemoryText(text, max = 1200) {
  return buildSafeText(String(text || ''), max);
}

function assertNoSecretLike(payload) {
  if (containsSecretLike(payload)) {
    const error = new Error(SECRET_REJECTION_MESSAGE);
    error.code = 'AGENT_MEMORY_SECRET_REJECTED';
    throw error;
  }
}

function getWorkspaceIdFromContext(context = {}, services = {}) {
  return normalizeWorkspaceId(context.workspaceId || services.workspaceId || context.workspace?.id || services.workspace?.id);
}

function getUserIdFromContext(context = {}, services = {}) {
  return normalizeUserId(context.userId || services.userId || context.actorId || services.actorId);
}

function buildMemoryRecord(input = {}, defaults = {}) {
  const content = String(input.content || input.text || '').trim();
  const title = String(input.title || compactText(content, 80) || 'Agent memory').trim();
  assertNoSecretLike({ title, content, tags: input.tags, source: input.source });

  return sanitizeSummary({
    id: input.id || createId('agent_mem'),
    agentId: normalizeAgentId(input.agentId || defaults.agentId),
    workspaceId: normalizeWorkspaceId(input.workspaceId || defaults.workspaceId),
    userId: normalizeUserId(input.userId || defaults.userId),
    type: VALID_MEMORY_TYPES.includes(input.type) ? input.type : (defaults.type || 'project_context'),
    title: sanitizeMemoryText(title, 180),
    content: sanitizeMemoryText(content, 1600),
    tags: parseTags(input.tags),
    source: sanitizeMemoryText(input.source || defaults.source || 'manual', 80),
    confidence: clampScore(input.confidence, 0.65),
    importance: clampScore(input.importance, 0.6),
    relevanceScore: clampScore(input.relevanceScore, 0),
    createdBy: normalizeUserId(input.createdBy || defaults.createdBy || defaults.userId),
    createdAt: input.createdAt || nowIso(),
    updatedAt: input.updatedAt || nowIso(),
    archivedAt: input.archivedAt || null,
    lastUsedAt: input.lastUsedAt || null,
    usageCount: Number(input.usageCount || 0)
  });
}

function isArchived(item = {}) {
  return Boolean(item.archivedAt || item.archived_at);
}

function compactMemory(memory = {}, max = 260) {
  return sanitizeSummary({
    id: memory.id,
    agentId: memory.agentId,
    workspaceId: memory.workspaceId,
    userId: memory.userId,
    type: memory.type,
    title: sanitizeMemoryText(memory.title, 120),
    content: sanitizeMemoryText(memory.content, max),
    tags: Array.isArray(memory.tags) ? memory.tags.slice(0, 12) : [],
    source: sanitizeMemoryText(memory.source, 80),
    confidence: clampScore(memory.confidence),
    importance: clampScore(memory.importance),
    relevanceScore: clampScore(memory.relevanceScore, 0),
    createdAt: memory.createdAt,
    updatedAt: memory.updatedAt,
    archivedAt: memory.archivedAt || null,
    lastUsedAt: memory.lastUsedAt || null,
    usageCount: Number(memory.usageCount || 0)
  });
}

async function auditAgentMemory(action, summary = {}, services = {}) {
  try {
    await services.auditLog?.recordAuditLog?.({
      actorType: services.actorType || 'system',
      actorId: String(summary.actorId || services.actorId || summary.userId || ''),
      action,
      targetType: summary.targetType || 'agent_memory',
      targetId: summary.targetId || summary.memoryId || summary.agentId || '',
      userId: summary.userId || services.userId || '',
      workspaceId: summary.workspaceId || services.workspaceId || '',
      decision: summary.decision || 'allowed',
      status: summary.status || 'ok',
      afterSummary: sanitizeSummary(summary)
    }, services);
  } catch (_) {}
}

function validateAgentMemoryId(value) {
  const id = String(value || '').trim();
  if (!id || id.length > 140) return null;
  if (!/^[a-zA-Z0-9_.:@-]+$/.test(id)) return null;
  return id;
}

module.exports = {
  AGENT_LEARNING_NOTES_KEY,
  AGENT_MEMORIES_KEY,
  AGENT_PROFILE_OVERRIDES_KEY,
  AGENT_SHARED_MEMORIES_KEY,
  DEFAULT_WORKSPACE_ID,
  SECRET_REJECTION_MESSAGE,
  VALID_MEMORY_TYPES,
  assertNoSecretLike,
  auditAgentMemory,
  buildMemoryRecord,
  clampScore,
  compactMemory,
  compactText,
  containsSecretLike,
  createId,
  getUserIdFromContext,
  getWorkspaceIdFromContext,
  isArchived,
  maskSecret,
  normalizeAgentId,
  normalizeUserId,
  normalizeWorkspaceId,
  nowIso,
  parseTags,
  safeRead,
  safeWrite,
  sanitizeMemoryText,
  sanitizeSummary,
  unique,
  validateAgentMemoryId
};

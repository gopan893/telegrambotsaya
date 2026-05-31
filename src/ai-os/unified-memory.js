'use strict';

const guards = require('./guards');
const aiosGuards = require('./aios-guards');
const utils = require('./aios-utils');

const STORAGE_KEY = 'aios_memories';

function normalizeMemoryInput(userId, input = {}) {
  const type = guards.MEMORY_TYPES.has(input.type) ? input.type : 'semantic';
  const content = guards.sanitizeText(input.content || input.text || '', 1800);
  const ts = guards.nowIso();
  const metadata = input.metadata && typeof input.metadata === 'object' ? { ...input.metadata } : {};
  const workspaceId = guards.sanitizeText(input.workspaceId || input.workspace_id || metadata.workspaceId || metadata.workspace_id || '', 160);
  if (workspaceId) metadata.workspaceId = workspaceId;
  return {
    id: input.id || guards.stableId('mem', `${userId}:${type}:${content}`),
    userId: guards.normalizeUserId(userId),
    type,
    content,
    workspaceId: workspaceId || null,
    metadata,
    tags: guards.uniqueList(input.tags || [], 12),
    source: guards.compactText(input.source || 'ai-os', 80),
    confidence: guards.clamp01(input.confidence, 0.65),
    importance: guards.clamp01(input.importance ?? guards.importanceFromText(content, type), 0.45),
    createdAt: input.createdAt || ts,
    updatedAt: input.updatedAt || ts,
    lastAccessedAt: input.lastAccessedAt || ts
  };
}

function scoreMemory(query, memory, typeFilter) {
  const relevance = guards.textRelevance(query, `${memory.content} ${(memory.tags || []).join(' ')}`);
  const last = Date.parse(memory.lastAccessedAt || memory.updatedAt || memory.createdAt || 0);
  const ageDays = last ? Math.max(0, (Date.now() - last) / (24 * 60 * 60 * 1000)) : 30;
  const recency = Math.max(0, 1 - ageDays / 60);
  const typeBoost = typeFilter && memory.type === typeFilter ? 0.14 : 0;
  return guards.clamp01((relevance * 0.45) + (memory.importance * 0.3) + (memory.confidence * 0.15) + (recency * 0.1) + typeBoost);
}

function dedupeKey(memory) {
  return `${memory.type}:${guards.compactText(memory.content, 160).toLowerCase()}`;
}

function addMemory(userId, input, botServices) {
  const state = guards.ensureAIOSState(userId, botServices);
  const memory = normalizeMemoryInput(userId, input);

  if (!memory.content || guards.detectPromptInjection(memory.content)) {
    return { ok: false, reason: 'MEMORY_REJECTED_BY_GUARD' };
  }

  const key = dedupeKey(memory);
  const existing = state.memories.find((item) => dedupeKey(item) === key);
  if (existing) {
    existing.confidence = Math.max(existing.confidence || 0.5, memory.confidence);
    existing.importance = Math.max(existing.importance || 0.4, memory.importance);
    existing.updatedAt = guards.nowIso();
    existing.lastAccessedAt = guards.nowIso();
    existing.tags = guards.uniqueList([...(existing.tags || []), ...(memory.tags || [])], 16);
    guards.touchState(state);
    mirrorMemoryToStorage(userId, state, botServices);
    guards.persistAsync(botServices);
    return { ok: true, memory: existing, deduped: true };
  }

  const contradictions = guards.detectKnowledgeInconsistency(state, memory.content);
  if (contradictions.length) memory.relatedContradictions = contradictions;

  state.memories.push(memory);
  pruneMemory(userId, {}, botServices);
  guards.touchState(state);
  mirrorMemoryToStorage(userId, state, botServices);
  guards.persistAsync(botServices);
  return { ok: true, memory, deduped: false };
}

async function createMemory(userId, data = {}, services) {
  const size = aiosGuards.preventHugeInput(data.content || data.text || '');
  if (!size.ok) return { ok: false, reason: size.reason };
  const result = addMemory(userId, data, services);
  if (result.ok) {
    const state = guards.ensureAIOSState(userId, services);
    await mirrorMemoryToStorage(userId, state, services);
  }
  return result;
}

async function listMemories(userId, options = {}, services) {
  const state = await hydrateMemoryFromStorage(userId, services);
  const limit = Math.max(1, Math.min(Number(options.limit || 10), 50));
  const type = options.type || null;
  return guards.safeArray(state.memories)
    .filter(memory => !type || memory.type === type)
    .sort((a, b) => Date.parse(b.updatedAt || b.createdAt || 0) - Date.parse(a.updatedAt || a.createdAt || 0))
    .slice(0, limit);
}

function searchMemory(userId, query = '', options = {}, botServices) {
  const state = guards.ensureAIOSState(userId, botServices);
  const limit = Math.max(1, Math.min(Number(options.limit || 8), 20));
  const type = options.type || null;
  const tags = guards.uniqueList(options.tags || [], 12);
  const q = guards.sanitizeText(query, 1200);

  const ranked = state.memories
    .filter((memory) => !type || memory.type === type)
    .filter((memory) => !tags.length || tags.some((tag) => (memory.tags || []).includes(tag)))
    .map((memory) => ({ memory, score: scoreMemory(q, memory, type) }))
    .filter((entry) => !q || entry.score > 0.12 || entry.memory.importance > 0.7)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  const ts = guards.nowIso();
  for (const entry of ranked) {
    entry.memory.lastAccessedAt = ts;
  }

  return ranked.map((entry) => ({ ...entry.memory, relevanceScore: Number(entry.score.toFixed(3)) }));
}

function getRelevantMemory(userId, query = '', options = {}, botServices) {
  const maxChars = Number(options.maxChars || 1600);
  const items = searchMemory(userId, query, options, botServices);
  return compressMemory(items, maxChars);
}

function updateMemory(userId, memoryId, patch = {}, botServices) {
  const state = guards.ensureAIOSState(userId, botServices);
  const memory = state.memories.find((item) => item.id === memoryId);
  if (!memory) return { ok: false, reason: 'MEMORY_NOT_FOUND' };

  if (patch.content !== undefined) {
    const content = guards.sanitizeText(patch.content, 1800);
    if (!content || guards.detectPromptInjection(content)) return { ok: false, reason: 'MEMORY_REJECTED_BY_GUARD' };
    memory.content = content;
  }
  if (patch.type && guards.MEMORY_TYPES.has(patch.type)) memory.type = patch.type;
  if (patch.tags) memory.tags = guards.uniqueList(patch.tags, 16);
  if (patch.confidence !== undefined) memory.confidence = guards.clamp01(patch.confidence, memory.confidence);
  if (patch.importance !== undefined) memory.importance = guards.clamp01(patch.importance, memory.importance);
  if (patch.source) memory.source = guards.compactText(patch.source, 80);
  memory.updatedAt = guards.nowIso();
  guards.touchState(state);
  mirrorMemoryToStorage(userId, state, botServices);
  guards.persistAsync(botServices);
  return { ok: true, memory };
}

async function deleteMemory(userId, memoryId, services) {
  const state = await hydrateMemoryFromStorage(userId, services);
  const before = state.memories.length;
  state.memories = state.memories.filter(memory => memory.id !== memoryId);
  if (state.memories.length === before) return { ok: false, reason: 'MEMORY_NOT_FOUND' };
  guards.touchState(state);
  await mirrorMemoryToStorage(userId, state, services);
  guards.persistAsync(services);
  return { ok: true, deleted: memoryId };
}

function pruneMemory(userId, options = {}, botServices) {
  const state = guards.ensureAIOSState(userId, botServices);
  const limit = Math.max(20, Math.min(Number(options.limit || guards.DEFAULT_LIMITS.memories), guards.DEFAULT_LIMITS.memories));
  const staleRemoved = guards.cleanupStaleMemory(state, Number(options.maxAgeDays || 150));
  const before = state.memories.length;
  state.memories = guards.pruneListByScore(state.memories, limit, (memory) => {
    const access = Date.parse(memory.lastAccessedAt || memory.updatedAt || memory.createdAt || 0);
    const recency = access ? Math.max(0, 1 - ((Date.now() - access) / (120 * 24 * 60 * 60 * 1000))) : 0.3;
    return (memory.importance || 0.4) + (memory.confidence || 0.5) * 0.4 + recency * 0.2;
  });
  mirrorMemoryToStorage(userId, state, botServices);
  return { pruned: before - state.memories.length + staleRemoved, remaining: state.memories.length };
}

function compressMemory(memories = [], maxChars = 1600) {
  const lines = guards.safeArray(memories).map((memory) => {
    const score = memory.relevanceScore !== undefined ? ` r=${memory.relevanceScore}` : '';
    return `- [${memory.type}${score}] ${guards.compactText(memory.content, 220)}`;
  });

  let output = '';
  for (const line of lines) {
    if ((output + line + '\n').length > maxChars) break;
    output += `${line}\n`;
  }
  return output.trim() || '-';
}

function getMemoryStats(userId, botServices) {
  const state = guards.ensureAIOSState(userId, botServices);
  const byType = {};
  let confidenceTotal = 0;
  let importanceTotal = 0;
  for (const memory of state.memories) {
    byType[memory.type] = (byType[memory.type] || 0) + 1;
    confidenceTotal += guards.clamp01(memory.confidence, 0.5);
    importanceTotal += guards.clamp01(memory.importance, 0.5);
  }
  const total = state.memories.length || 1;
  return {
    total: state.memories.length,
    byType,
    averageConfidence: Number((confidenceTotal / total).toFixed(3)),
    averageImportance: Number((importanceTotal / total).toFixed(3))
  };
}

function resetMemory(userId, botServices) {
  const state = guards.ensureAIOSState(userId, botServices);
  state.memories = [];
  guards.touchState(state);
  mirrorMemoryToStorage(userId, state, botServices);
  guards.persistAsync(botServices);
  return { ok: true };
}

async function hydrateMemoryFromStorage(userId, services = {}) {
  const state = guards.ensureAIOSState(userId, services);
  if (!services.storageManager?.loadData) return state;
  try {
    const stored = await utils.loadUserBucket(STORAGE_KEY, userId, services, []);
    if (stored.length && !state.memories.length) {
      state.memories = aiosGuards.enforceMemoryLimit(stored);
      guards.touchState(state);
    }
  } catch (_) {}
  return state;
}

async function mirrorMemoryToStorage(userId, state, services = {}) {
  if (!services.storageManager?.saveData) return false;
  try {
    const safe = aiosGuards.enforceMemoryLimit(guards.safeArray(state.memories));
    state.memories = safe;
    return await utils.saveUserBucket(STORAGE_KEY, userId, safe, services);
  } catch (_) {
    return false;
  }
}

module.exports = {
  STORAGE_KEY,
  createMemory,
  listMemories,
  addMemory,
  searchMemory,
  getRelevantMemory,
  updateMemory,
  deleteMemory,
  pruneMemory,
  compressMemory,
  getMemoryStats,
  resetMemory,
  scoreMemory,
  hydrateMemoryFromStorage
};

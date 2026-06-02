'use strict';

const relevance = require('./agent-memory-relevance');
const {
  AGENT_MEMORIES_KEY,
  AGENT_SHARED_MEMORIES_KEY,
  assertNoSecretLike,
  auditAgentMemory,
  buildMemoryRecord,
  compactMemory,
  createId,
  getUserIdFromContext,
  getWorkspaceIdFromContext,
  isArchived,
  normalizeAgentId,
  normalizeWorkspaceId,
  nowIso,
  safeRead,
  safeWrite,
  sanitizeSummary,
  validateAgentMemoryId
} = require('./agent-memory-utils');

function defaultSeedMemories() {
  const createdAt = '2026-01-01T00:00:00.000Z';
  return [
    buildMemoryRecord({
      id: 'seed_orchestrator_safe_routing',
      agentId: 'orchestrator',
      workspaceId: 'default',
      userId: '',
      type: 'lesson',
      title: 'Routing aman dan hemat agent',
      content: 'Gunakan agent spesialis hanya jika relevan. Sapaan sederhana cukup dijawab Orchestrator.',
      tags: ['routing', 'safety', 'phase21'],
      source: 'phase21_seed',
      importance: 0.7,
      confidence: 0.8,
      createdAt
    }),
    buildMemoryRecord({
      id: 'seed_coder_commonjs_render',
      agentId: 'coder',
      workspaceId: 'default',
      userId: '',
      type: 'technical_pattern',
      title: 'Stack utama bot',
      content: 'Project memakai Node.js 20, CommonJS, Express webhook, Telegram Bot API, PostgreSQL optional, Redis optional, JSON fallback, dan Render target.',
      tags: ['nodejs', 'commonjs', 'render', 'telegram'],
      source: 'phase21_seed',
      importance: 0.86,
      confidence: 0.9,
      createdAt
    }),
    buildMemoryRecord({
      id: 'seed_security_no_secret_memory',
      agentId: 'security',
      workspaceId: 'default',
      userId: '',
      type: 'security_note',
      title: 'Data sensitif tidak boleh disimpan',
      content: 'Nilai rahasia seperti akses bot, connection string, dan header otorisasi harus ditolak dari memory dan output.',
      tags: ['safety', 'approval', 'audit'],
      source: 'phase21_seed',
      importance: 0.95,
      confidence: 0.95,
      createdAt
    })
  ];
}

async function loadAgentMemories(services = {}) {
  const data = await safeRead(AGENT_MEMORIES_KEY, [], services);
  return Array.isArray(data) ? data : [];
}

async function saveAgentMemories(memories = [], services = {}) {
  return await safeWrite(AGENT_MEMORIES_KEY, sanitizeSummary(memories), services);
}

async function loadSharedMemories(services = {}) {
  const data = await safeRead(AGENT_SHARED_MEMORIES_KEY, [], services);
  return Array.isArray(data) ? data : [];
}

async function saveSharedMemories(memories = [], services = {}) {
  return await safeWrite(AGENT_SHARED_MEMORIES_KEY, sanitizeSummary(memories), services);
}

function withSeed(memories = [], options = {}) {
  if (options.includeDefaults === false) return memories;
  const existingIds = new Set(memories.map(item => item.id));
  return [
    ...memories,
    ...defaultSeedMemories().filter(item => !existingIds.has(item.id))
  ];
}

function applyFilters(items = [], filters = {}) {
  const workspaceId = filters.workspaceId ? normalizeWorkspaceId(filters.workspaceId) : null;
  const agentId = filters.agentId ? normalizeAgentId(filters.agentId) : null;
  const userId = filters.userId ? String(filters.userId) : null;
  const type = filters.type ? String(filters.type) : null;
  const includeArchived = Boolean(filters.includeArchived);
  return items.filter(item => {
    if (!includeArchived && isArchived(item)) return false;
    if (workspaceId && item.workspaceId !== workspaceId) return false;
    if (agentId && item.agentId !== agentId) return false;
    if (userId && item.userId && item.userId !== userId) return false;
    if (type && item.type !== type) return false;
    return true;
  });
}

async function createAgentMemory(input = {}, services = {}) {
  const defaults = {
    agentId: input.agentId || services.agentId || 'orchestrator',
    workspaceId: input.workspaceId || services.workspaceId || 'default',
    userId: input.userId || services.userId || services.actorId || '',
    createdBy: input.createdBy || services.actorId || services.userId || ''
  };
  const item = buildMemoryRecord(input, defaults);
  const memories = await loadAgentMemories(services);
  memories.unshift(item);
  await saveAgentMemories(memories.slice(0, 5000), services);
  await auditAgentMemory('agents/memory_created', {
    agentId: item.agentId,
    workspaceId: item.workspaceId,
    userId: item.userId,
    actorId: item.createdBy,
    memoryId: item.id,
    targetId: item.id,
    title: item.title,
    type: item.type
  }, services);
  return compactMemory(item, 500);
}

async function createSharedAgentMemory(input = {}, services = {}) {
  assertNoSecretLike(input);
  const item = buildMemoryRecord({
    ...input,
    agentId: 'shared',
    type: input.type || 'shared_context'
  }, {
    agentId: 'shared',
    workspaceId: input.workspaceId || services.workspaceId || 'default',
    userId: input.userId || services.userId || '',
    createdBy: input.createdBy || services.actorId || services.userId || ''
  });
  const memories = await loadSharedMemories(services);
  memories.unshift(item);
  await saveSharedMemories(memories.slice(0, 2000), services);
  await auditAgentMemory('agents/shared_memory_created', {
    workspaceId: item.workspaceId,
    userId: item.userId,
    actorId: item.createdBy,
    memoryId: item.id,
    targetId: item.id,
    title: item.title
  }, services);
  return compactMemory(item, 500);
}

async function listAgentMemories(filters = {}, services = {}) {
  const limit = Math.min(Math.max(Number(filters.limit || 20), 1), 100);
  const items = applyFilters(withSeed(await loadAgentMemories(services), filters), filters)
    .sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')))
    .slice(0, limit)
    .map(item => compactMemory(item, 600));
  return items;
}

async function listSharedAgentMemories(filters = {}, services = {}) {
  const limit = Math.min(Math.max(Number(filters.limit || 20), 1), 100);
  return applyFilters(await loadSharedMemories(services), { ...filters, agentId: null })
    .sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')))
    .slice(0, limit)
    .map(item => compactMemory(item, 600));
}

async function getAgentMemory(memoryId, services = {}) {
  const cleanId = validateAgentMemoryId(memoryId);
  if (!cleanId) return null;
  const all = withSeed(await loadAgentMemories(services)).concat(await loadSharedMemories(services));
  const found = all.find(item => item.id === cleanId);
  return found ? compactMemory(found, 800) : null;
}

async function updateAgentMemory(memoryId, patch = {}, services = {}) {
  const cleanId = validateAgentMemoryId(memoryId);
  if (!cleanId) throw new Error('INVALID_MEMORY_ID');
  assertNoSecretLike(patch);
  const memories = await loadAgentMemories(services);
  const index = memories.findIndex(item => item.id === cleanId);
  if (index < 0) throw new Error('AGENT_MEMORY_NOT_FOUND');
  const previous = memories[index];
  const next = buildMemoryRecord({
    ...previous,
    ...patch,
    id: previous.id,
    agentId: previous.agentId,
    workspaceId: previous.workspaceId,
    userId: previous.userId,
    createdAt: previous.createdAt,
    createdBy: previous.createdBy,
    updatedAt: nowIso()
  }, previous);
  memories[index] = next;
  await saveAgentMemories(memories, services);
  await auditAgentMemory('agents/memory_updated', {
    agentId: next.agentId,
    workspaceId: next.workspaceId,
    userId: next.userId,
    actorId: services.actorId || services.userId || '',
    memoryId: next.id,
    targetId: next.id,
    before: { title: previous.title, type: previous.type },
    after: { title: next.title, type: next.type }
  }, services);
  return compactMemory(next, 600);
}

async function archiveAgentMemory(memoryId, actor = {}, services = {}) {
  const cleanId = validateAgentMemoryId(memoryId);
  if (!cleanId) throw new Error('INVALID_MEMORY_ID');
  const memories = await loadAgentMemories(services);
  const index = memories.findIndex(item => item.id === cleanId);
  if (index < 0) throw new Error('AGENT_MEMORY_NOT_FOUND');
  memories[index] = { ...memories[index], archivedAt: nowIso(), updatedAt: nowIso() };
  await saveAgentMemories(memories, services);
  await auditAgentMemory('agents/memory_archived', {
    agentId: memories[index].agentId,
    workspaceId: memories[index].workspaceId,
    userId: memories[index].userId,
    actorId: actor.actorId || actor.userId || services.actorId || '',
    memoryId: cleanId,
    targetId: cleanId
  }, services);
  return compactMemory(memories[index]);
}

async function restoreAgentMemory(memoryId, actor = {}, services = {}) {
  const cleanId = validateAgentMemoryId(memoryId);
  if (!cleanId) throw new Error('INVALID_MEMORY_ID');
  const memories = await loadAgentMemories(services);
  const index = memories.findIndex(item => item.id === cleanId);
  if (index < 0) throw new Error('AGENT_MEMORY_NOT_FOUND');
  memories[index] = { ...memories[index], archivedAt: null, updatedAt: nowIso() };
  await saveAgentMemories(memories, services);
  await auditAgentMemory('agents/memory_restored', {
    agentId: memories[index].agentId,
    workspaceId: memories[index].workspaceId,
    userId: memories[index].userId,
    actorId: actor.actorId || actor.userId || services.actorId || '',
    memoryId: cleanId,
    targetId: cleanId
  }, services);
  return compactMemory(memories[index]);
}

async function searchAgentMemories(query = '', context = {}, services = {}) {
  const q = String(query || '').toLowerCase();
  const workspaceId = getWorkspaceIdFromContext(context, services);
  const userId = getUserIdFromContext(context, services);
  const all = withSeed(await loadAgentMemories(services)).concat(await loadSharedMemories(services));
  return all
    .filter(item => !isArchived(item))
    .filter(item => !item.workspaceId || item.workspaceId === workspaceId)
    .filter(item => !item.userId || !userId || item.userId === userId || item.agentId === 'shared')
    .filter(item => `${item.title} ${item.content} ${(item.tags || []).join(' ')}`.toLowerCase().includes(q))
    .slice(0, Math.min(Math.max(Number(context.limit || 20), 1), 100))
    .map(item => compactMemory(item, 500));
}

async function getRelevantAgentMemories(agentId, message = '', context = {}, services = {}) {
  const cleanAgentId = normalizeAgentId(agentId);
  const workspaceId = getWorkspaceIdFromContext(context, services);
  const userId = getUserIdFromContext(context, services);
  const agentMemories = applyFilters(withSeed(await loadAgentMemories(services)), {
    agentId: cleanAgentId,
    workspaceId,
    userId,
    includeArchived: false
  });
  const sharedMemories = applyFilters(await loadSharedMemories(services), {
    workspaceId,
    includeArchived: false
  });
  const filteredAgent = relevance.filterRelevantMemories(agentMemories, message, { id: cleanAgentId, memoryPolicy: context.memoryPolicy || {} }, {
    ...context,
    agentId: cleanAgentId,
    workspaceId,
    userId,
    maxAgentMemories: Math.min(Number(context.maxAgentMemories || 5), 5)
  }, services);
  const shared = sharedMemories
    .map(item => ({ ...item, relevanceScore: relevance.scoreSharedMemory(item, message, { ...context, agentId: cleanAgentId, workspaceId, userId }, services) }))
    .filter(item => relevance.preventMemoryLeakageAcrossDomains(item, { ...context, workspaceId, userId }).ok)
    .filter(item => item.relevanceScore >= Number(context.minRelevanceScore || 0.18))
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, Math.min(Number(context.maxSharedMemories || 3), 3))
    .map(item => compactMemory(item, 360));

  return {
    agentId: cleanAgentId,
    workspaceId,
    userId,
    memories: filteredAgent,
    sharedMemories: shared,
    explanation: relevance.buildMemoryUseExplanation([...filteredAgent, ...shared], message)
  };
}

async function markMemoriesUsed(memories = [], services = {}) {
  const ids = new Set((memories || []).map(item => item.id).filter(id => !String(id).startsWith('seed_')));
  if (!ids.size) return;
  const all = await loadAgentMemories(services);
  const now = nowIso();
  const next = all.map(item => ids.has(item.id)
    ? { ...item, lastUsedAt: now, usageCount: Number(item.usageCount || 0) + 1, updatedAt: now }
    : item);
  await saveAgentMemories(next, services);
}

async function pruneLowValueAgentMemories(options = {}, services = {}) {
  const memories = await loadAgentMemories(services);
  const workspaceId = options.workspaceId ? normalizeWorkspaceId(options.workspaceId) : null;
  const now = nowIso();
  let archived = 0;
  const next = memories.map(item => {
    if (isArchived(item)) return item;
    if (workspaceId && item.workspaceId !== workspaceId) return item;
    const low = Number(item.importance || 0) < Number(options.minImportance || 0.18) && Number(item.confidence || 0) < Number(options.minConfidence || 0.25);
    if (!low) return item;
    archived += 1;
    return { ...item, archivedAt: now, updatedAt: now };
  });
  await saveAgentMemories(next, services);
  return { archived };
}

module.exports = {
  createAgentMemory,
  createSharedAgentMemory,
  getAgentMemory,
  getRelevantAgentMemories,
  listAgentMemories,
  listSharedAgentMemories,
  loadAgentMemories,
  loadSharedMemories,
  markMemoriesUsed,
  pruneLowValueAgentMemories,
  restoreAgentMemory,
  saveAgentMemories,
  saveSharedMemories,
  searchAgentMemories,
  updateAgentMemory,
  archiveAgentMemory
};

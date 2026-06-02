'use strict';

const memoryStore = require('./agent-memory-store');
const {
  AGENT_LEARNING_NOTES_KEY,
  assertNoSecretLike,
  auditAgentMemory,
  compactMemory,
  createId,
  getUserIdFromContext,
  getWorkspaceIdFromContext,
  isArchived,
  normalizeAgentId,
  normalizeWorkspaceId,
  nowIso,
  parseTags,
  safeRead,
  safeWrite,
  sanitizeMemoryText,
  sanitizeSummary,
  validateAgentMemoryId
} = require('./agent-memory-utils');

async function loadLearningNotes(services = {}) {
  const data = await safeRead(AGENT_LEARNING_NOTES_KEY, [], services);
  return Array.isArray(data) ? data : [];
}

async function saveLearningNotes(notes = [], services = {}) {
  return await safeWrite(AGENT_LEARNING_NOTES_KEY, sanitizeSummary(notes), services);
}

function buildLearningNote(input = {}, services = {}) {
  const content = String(input.content || input.note || input.text || '').trim();
  const title = String(input.title || sanitizeMemoryText(content, 80) || 'Learning note').trim();
  assertNoSecretLike({ title, content, tags: input.tags });
  return sanitizeSummary({
    id: input.id || createId('agent_note'),
    agentId: normalizeAgentId(input.agentId || services.agentId || 'orchestrator'),
    workspaceId: normalizeWorkspaceId(input.workspaceId || services.workspaceId || 'default'),
    userId: String(input.userId || services.userId || services.actorId || ''),
    title: sanitizeMemoryText(title, 160),
    content: sanitizeMemoryText(content, 1600),
    tags: parseTags(input.tags),
    source: sanitizeMemoryText(input.source || 'manual', 80),
    confidence: Number(input.confidence || 0.7),
    importance: Number(input.importance || 0.6),
    createdBy: String(input.createdBy || services.actorId || services.userId || ''),
    createdAt: input.createdAt || nowIso(),
    updatedAt: input.updatedAt || nowIso(),
    archivedAt: input.archivedAt || null
  });
}

async function createLearningNote(input = {}, services = {}) {
  const note = buildLearningNote(input, services);
  const notes = await loadLearningNotes(services);
  notes.unshift(note);
  await saveLearningNotes(notes.slice(0, 3000), services);
  await auditAgentMemory('agents/learning_note_created', {
    agentId: note.agentId,
    workspaceId: note.workspaceId,
    userId: note.userId,
    actorId: note.createdBy,
    targetId: note.id,
    title: note.title
  }, services);
  return compactMemory({ ...note, type: 'learning_note' }, 500);
}

async function listLearningNotes(filters = {}, services = {}) {
  const limit = Math.min(Math.max(Number(filters.limit || 20), 1), 100);
  const workspaceId = filters.workspaceId ? normalizeWorkspaceId(filters.workspaceId) : null;
  const userId = filters.userId ? String(filters.userId) : null;
  const agentId = filters.agentId ? normalizeAgentId(filters.agentId) : null;
  return (await loadLearningNotes(services))
    .filter(note => filters.includeArchived || !isArchived(note))
    .filter(note => !workspaceId || note.workspaceId === workspaceId)
    .filter(note => !userId || !note.userId || note.userId === userId)
    .filter(note => !agentId || note.agentId === agentId)
    .sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')))
    .slice(0, limit)
    .map(note => compactMemory({ ...note, type: 'learning_note' }, 500));
}

async function summarizeLearningNotes(agentId, context = {}, services = {}) {
  const notes = await listLearningNotes({
    agentId,
    workspaceId: getWorkspaceIdFromContext(context, services),
    userId: getUserIdFromContext(context, services),
    limit: context.limit || 5
  }, services);
  if (!notes.length) return 'Belum ada learning notes relevan.';
  return notes.map(note => `- ${note.title}: ${sanitizeMemoryText(note.content, 180)}`).join('\n');
}

async function convertLearningNoteToMemory(noteId, services = {}) {
  const cleanId = validateAgentMemoryId(noteId);
  if (!cleanId) throw new Error('INVALID_NOTE_ID');
  const notes = await loadLearningNotes(services);
  const note = notes.find(item => item.id === cleanId);
  if (!note || isArchived(note)) throw new Error('LEARNING_NOTE_NOT_FOUND');
  const memory = await memoryStore.createAgentMemory({
    agentId: note.agentId,
    workspaceId: note.workspaceId,
    userId: note.userId,
    type: 'learning_note',
    title: note.title,
    content: note.content,
    tags: note.tags,
    source: `learning_note:${note.id}`,
    confidence: note.confidence,
    importance: note.importance,
    createdBy: note.createdBy
  }, services);
  await auditAgentMemory('agents/learning_note_converted', {
    agentId: note.agentId,
    workspaceId: note.workspaceId,
    userId: note.userId,
    targetId: note.id,
    memoryId: memory.id
  }, services);
  return memory;
}

async function archiveLearningNote(noteId, actor = {}, services = {}) {
  const cleanId = validateAgentMemoryId(noteId);
  if (!cleanId) throw new Error('INVALID_NOTE_ID');
  const notes = await loadLearningNotes(services);
  const index = notes.findIndex(note => note.id === cleanId);
  if (index < 0) throw new Error('LEARNING_NOTE_NOT_FOUND');
  notes[index] = { ...notes[index], archivedAt: nowIso(), updatedAt: nowIso() };
  await saveLearningNotes(notes, services);
  await auditAgentMemory('agents/learning_note_archived', {
    agentId: notes[index].agentId,
    workspaceId: notes[index].workspaceId,
    userId: notes[index].userId,
    actorId: actor.actorId || actor.userId || services.actorId || '',
    targetId: cleanId
  }, services);
  return compactMemory({ ...notes[index], type: 'learning_note' }, 500);
}

module.exports = {
  archiveLearningNote,
  convertLearningNoteToMemory,
  createLearningNote,
  listLearningNotes,
  loadLearningNotes,
  saveLearningNotes,
  summarizeLearningNotes
};

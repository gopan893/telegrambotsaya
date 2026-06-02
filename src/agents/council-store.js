'use strict';

const {
  COUNCIL_SESSIONS_KEY,
  COUNCIL_SUMMARIES_KEY,
  DEBATE_RECORDS_KEY,
  auditCouncil,
  buildEmptyCouncilSession,
  normalizeWorkspaceId,
  nowIso,
  safeRead,
  safeWrite,
  sanitizeCouncilPayload
} = require('./council-utils');

async function loadCouncilSessions(services = {}) {
  const data = await safeRead(COUNCIL_SESSIONS_KEY, [], services);
  return Array.isArray(data) ? data : [];
}

async function saveCouncilSessions(items = [], services = {}) {
  return await safeWrite(COUNCIL_SESSIONS_KEY, sanitizeCouncilPayload(items), services);
}

async function createSession(input = {}, services = {}) {
  const session = buildEmptyCouncilSession(input);
  const sessions = await loadCouncilSessions(services);
  sessions.unshift(session);
  await saveCouncilSessions(sessions.slice(0, 1000), services);
  await auditCouncil('agents/council_session_created', {
    sessionId: session.id,
    workspaceId: session.workspaceId,
    userId: session.userId,
    mode: session.mode,
    selectedAgents: session.selectedAgents,
    riskLevel: session.riskLevel,
    approvalRequired: session.approvalRequired
  }, services);
  return session;
}

async function updateSession(sessionId, patch = {}, services = {}) {
  const sessions = await loadCouncilSessions(services);
  const index = sessions.findIndex(item => item.id === sessionId);
  if (index < 0) throw new Error('COUNCIL_SESSION_NOT_FOUND');
  const next = sanitizeCouncilPayload({
    ...sessions[index],
    ...patch,
    id: sessions[index].id,
    updatedAt: nowIso()
  });
  sessions[index] = next;
  await saveCouncilSessions(sessions, services);
  return next;
}

async function getSession(sessionId, services = {}) {
  return (await loadCouncilSessions(services)).find(item => item.id === sessionId) || null;
}

async function listSessions(filters = {}, services = {}) {
  const limit = Math.min(Math.max(Number(filters.limit || 30), 1), 100);
  const workspaceId = filters.workspaceId ? normalizeWorkspaceId(filters.workspaceId) : null;
  const source = filters.source ? String(filters.source) : null;
  const mode = filters.mode ? String(filters.mode) : null;
  return (await loadCouncilSessions(services))
    .filter(item => !workspaceId || item.workspaceId === workspaceId)
    .filter(item => !source || item.source === source)
    .filter(item => !mode || item.mode === mode)
    .slice(0, limit)
    .map(sanitizeCouncilPayload);
}

async function appendSummary(summary = {}, services = {}) {
  const items = await safeRead(COUNCIL_SUMMARIES_KEY, [], services);
  const list = Array.isArray(items) ? items : [];
  const item = sanitizeCouncilPayload({
    ...summary,
    createdAt: summary.createdAt || nowIso()
  });
  list.unshift(item);
  await safeWrite(COUNCIL_SUMMARIES_KEY, list.slice(0, 1000), services);
  return item;
}

async function listSummaries(filters = {}, services = {}) {
  const limit = Math.min(Math.max(Number(filters.limit || 30), 1), 100);
  const workspaceId = filters.workspaceId ? normalizeWorkspaceId(filters.workspaceId) : null;
  const items = await safeRead(COUNCIL_SUMMARIES_KEY, [], services);
  return (Array.isArray(items) ? items : [])
    .filter(item => !workspaceId || item.workspaceId === workspaceId)
    .slice(0, limit)
    .map(sanitizeCouncilPayload);
}

async function appendDebateRecord(record = {}, services = {}) {
  const items = await safeRead(DEBATE_RECORDS_KEY, [], services);
  const list = Array.isArray(items) ? items : [];
  const item = sanitizeCouncilPayload({
    ...record,
    createdAt: record.createdAt || nowIso()
  });
  list.unshift(item);
  await safeWrite(DEBATE_RECORDS_KEY, list.slice(0, 1000), services);
  return item;
}

module.exports = {
  appendDebateRecord,
  appendSummary,
  createSession,
  getSession,
  listSessions,
  listSummaries,
  loadCouncilSessions,
  saveCouncilSessions,
  updateSession
};

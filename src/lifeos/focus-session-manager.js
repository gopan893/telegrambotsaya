'use strict';

const store = require('./lifeos-store');
const utils = require('./lifeos-utils');

async function createFocusSession(input = {}, services = {}) {
  if (utils.containsSecretLike(input)) return { ok: false, reason: 'SECRET_LIKE_FOCUS_REJECTED', status: 400 };
  const duration = Math.min(Math.max(Number(input.durationMinutes || 25), 5), 180);
  const item = utils.buildLifeItem({
    ...input,
    type: 'focus_session',
    status: 'planned',
    title: input.title || 'Focus block',
    data: {
      durationMinutes: duration,
      targetTaskId: input.targetTaskId || '',
      startedAt: '',
      endedAt: '',
      ...(input.data || {})
    }
  }, services);
  await store.upsertLifeItem(item, services);
  await utils.auditLife('lifeos/focus_session_created', { workspaceId: item.workspaceId, userId: item.userId, targetId: item.id, summary: { durationMinutes: duration } }, services);
  return { ok: true, session: item };
}

async function startFocusSessionPlan(sessionId, services = {}) {
  const current = await store.getLifeItem(sessionId, services);
  if (!current || current.type !== 'focus_session') return { ok: false, reason: 'FOCUS_SESSION_NOT_FOUND', status: 404 };
  const next = { ...current, status: 'doing', updatedAt: utils.nowIso(), data: { ...(current.data || {}), startedAt: utils.nowIso() } };
  await store.upsertLifeItem(next, services);
  return { ok: true, session: next };
}

async function completeFocusSession(sessionId, services = {}) {
  const current = await store.getLifeItem(sessionId, services);
  if (!current || current.type !== 'focus_session') return { ok: false, reason: 'FOCUS_SESSION_NOT_FOUND', status: 404 };
  const next = { ...current, status: 'completed', updatedAt: utils.nowIso(), data: { ...(current.data || {}), endedAt: utils.nowIso() } };
  await store.upsertLifeItem(next, services);
  await utils.auditLife('lifeos/focus_session_completed', { workspaceId: next.workspaceId, userId: next.userId, targetId: next.id }, services);
  return { ok: true, session: next };
}

async function summarizeFocusSessions(range = {}, services = {}) {
  const sessions = await store.listLifeItems({ workspaceId: services.workspaceId, userId: services.userId, type: 'focus_session', limit: 100 }, services);
  const completed = sessions.filter((item) => item.status === 'completed');
  return {
    ok: true,
    total: sessions.length,
    completed: completed.length,
    planned: sessions.filter((item) => item.status === 'planned').length,
    totalMinutes: completed.reduce((sum, item) => sum + Number(item.data?.durationMinutes || 0), 0)
  };
}

async function suggestFocusBlock(services = {}) {
  const tasks = await store.listLifeItems({ workspaceId: services.workspaceId, userId: services.userId, type: 'personal_task', limit: 50 }, services);
  const target = tasks.find((item) => !['done', 'archived'].includes(item.status));
  return {
    ok: true,
    title: target ? `Focus: ${target.title}` : 'Focus: one small useful task',
    durationMinutes: target?.priority === 'high' || target?.priority === 'critical' ? 45 : 25,
    targetTaskId: target?.id || '',
    note: 'Tidak ada device control atau monitoring intrusif.'
  };
}

module.exports = {
  completeFocusSession,
  createFocusSession,
  startFocusSessionPlan,
  suggestFocusBlock,
  summarizeFocusSessions
};

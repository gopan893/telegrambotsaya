'use strict';

const store = require('./lifeos-store');
const utils = require('./lifeos-utils');

function suggestReminderSchedule(input = {}, services = {}) {
  const text = `${input.title || ''} ${input.description || ''}`.toLowerCase();
  if (input.scheduledAt) return { ok: true, scheduledAt: input.scheduledAt, reason: 'user provided schedule' };
  const date = new Date();
  if (/malam|night|evening/.test(text)) date.setUTCHours(13, 0, 0, 0);
  else if (/pagi|morning/.test(text)) date.setUTCHours(23, 0, 0, 0);
  else date.setUTCHours(date.getUTCHours() + 2, 0, 0, 0);
  return { ok: true, scheduledAt: date.toISOString(), reason: 'suggested lightweight reminder time' };
}

async function createReminderPlan(input = {}, services = {}) {
  if (utils.containsSecretLike(input)) return { ok: false, reason: 'SECRET_LIKE_REMINDER_REJECTED', status: 400 };
  const schedule = suggestReminderSchedule(input, services);
  const item = utils.buildLifeItem({
    ...input,
    type: 'reminder',
    status: 'planned',
    scheduledAt: schedule.scheduledAt,
    data: {
      requiresApproval: Boolean(input.requiresApproval),
      quietHoursRespected: true,
      notificationSystem: services.routineScheduler ? 'routine_scheduler_available' : 'plan_only',
      scheduleReason: schedule.reason,
      ...(input.data || {})
    }
  }, services);
  await store.upsertLifeItem(item, services);
  await utils.auditLife('lifeos/reminder_plan_created', { workspaceId: item.workspaceId, userId: item.userId, targetId: item.id, summary: { scheduledAt: item.scheduledAt, planOnly: true } }, services);
  return { ok: true, reminder: item, schedule };
}

async function listReminderPlans(filters = {}, services = {}) {
  return store.listLifeItems({ ...filters, type: 'reminder' }, services);
}

async function markReminderDone(reminderId, services = {}) {
  const current = await store.getLifeItem(reminderId, services);
  if (!current || current.type !== 'reminder') return { ok: false, reason: 'REMINDER_NOT_FOUND', status: 404 };
  const next = { ...current, status: 'done', updatedAt: utils.nowIso(), data: { ...(current.data || {}), completedAt: utils.nowIso() } };
  await store.upsertLifeItem(next, services);
  return { ok: true, reminder: next };
}

function buildReminderNotification(reminder = {}, services = {}) {
  return {
    ok: true,
    text: utils.sanitizeText(`Reminder: ${reminder.title || 'personal reminder'}${reminder.description ? ` — ${reminder.description}` : ''}`, 500),
    scheduledAt: reminder.scheduledAt || '',
    quietHoursRespected: true
  };
}

module.exports = {
  buildReminderNotification,
  createReminderPlan,
  listReminderPlans,
  markReminderDone,
  suggestReminderSchedule
};

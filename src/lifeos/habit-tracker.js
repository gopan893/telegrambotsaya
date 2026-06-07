'use strict';

const store = require('./lifeos-store');
const utils = require('./lifeos-utils');

async function createHabit(input = {}, services = {}) {
  if (utils.containsSecretLike(input)) return { ok: false, reason: 'SECRET_LIKE_HABIT_REJECTED', status: 400 };
  const item = utils.buildLifeItem({
    ...input,
    type: 'habit',
    status: input.status || 'active',
    data: {
      frequency: input.frequency || 'daily',
      target: input.target || '1x',
      streak: 0,
      checkins: [],
      ...(input.data || {})
    }
  }, services);
  await store.upsertLifeItem(item, services);
  await utils.auditLife('lifeos/habit_created', { workspaceId: item.workspaceId, userId: item.userId, targetId: item.id, summary: { title: item.title, frequency: item.data.frequency } }, services);
  return { ok: true, habit: item };
}

async function updateHabit(habitId, patch = {}, services = {}) {
  if (utils.containsSecretLike(patch)) return { ok: false, reason: 'SECRET_LIKE_HABIT_PATCH_REJECTED', status: 400 };
  const current = await store.getLifeItem(habitId, services);
  if (!current || current.type !== 'habit') return { ok: false, reason: 'HABIT_NOT_FOUND', status: 404 };
  const next = utils.buildLifeItem({ ...current, ...patch, id: current.id, type: 'habit', createdAt: current.createdAt, data: { ...(current.data || {}), ...(patch.data || {}) } }, services);
  await store.upsertLifeItem(next, services);
  return { ok: true, habit: next };
}

async function logHabitCheckin(habitId, date, value = true, services = {}) {
  const current = await store.getLifeItem(habitId, services);
  if (!current || current.type !== 'habit') return { ok: false, reason: 'HABIT_NOT_FOUND', status: 404 };
  const dateKey = utils.getDateKey(date || new Date());
  const checkins = (current.data?.checkins || []).filter((item) => item.date !== dateKey);
  checkins.push({ date: dateKey, value: Boolean(value), createdAt: utils.nowIso() });
  const streak = computeStreak(checkins);
  const next = { ...current, data: { ...(current.data || {}), checkins, streak }, updatedAt: utils.nowIso() };
  await store.upsertLifeItem(next, services);
  await utils.auditLife('lifeos/habit_checkin', { workspaceId: next.workspaceId, userId: next.userId, targetId: next.id, summary: { date: dateKey, value: Boolean(value), streak } }, services);
  return { ok: true, habit: next, streak };
}

function computeStreak(checkins = []) {
  const done = new Set(checkins.filter((item) => item.value).map((item) => item.date));
  let streak = 0;
  const cursor = new Date();
  for (let i = 0; i < 365; i += 1) {
    const key = cursor.toISOString().slice(0, 10);
    if (!done.has(key)) break;
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

async function getHabitStreak(habitId, services = {}) {
  const habit = await store.getLifeItem(habitId, services);
  if (!habit || habit.type !== 'habit') return { ok: false, reason: 'HABIT_NOT_FOUND', status: 404 };
  return { ok: true, habitId, streak: Number(habit.data?.streak || computeStreak(habit.data?.checkins || [])) };
}

async function summarizeHabits(range = {}, services = {}) {
  const habits = await store.listLifeItems({ workspaceId: services.workspaceId, userId: services.userId, type: 'habit', limit: 100 }, services);
  return {
    ok: true,
    total: habits.length,
    active: habits.filter((habit) => habit.status === 'active').length,
    checkins: habits.reduce((sum, habit) => sum + (habit.data?.checkins || []).length, 0),
    topStreaks: habits.slice().sort((a, b) => Number(b.data?.streak || 0) - Number(a.data?.streak || 0)).slice(0, 5)
  };
}

async function suggestHabitAdjustment(habitId, services = {}) {
  const habit = await store.getLifeItem(habitId, services);
  if (!habit || habit.type !== 'habit') return { ok: false, reason: 'HABIT_NOT_FOUND', status: 404 };
  const streak = Number(habit.data?.streak || 0);
  return {
    ok: true,
    suggestion: streak >= 7
      ? 'Pertahankan ritme ini, jangan naikkan target terlalu cepat.'
      : 'Buat target lebih kecil dan mudah dicek; skip/pause boleh tanpa rasa bersalah.',
    habit
  };
}

module.exports = {
  createHabit,
  getHabitStreak,
  logHabitCheckin,
  summarizeHabits,
  suggestHabitAdjustment,
  updateHabit
};

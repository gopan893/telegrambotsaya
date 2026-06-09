'use strict';

const schedules = new Map();
let schedulerId = 0;

function parseCronExpression(cron) {
  if (!cron) return null;
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return null;
  return { minute: parts[0], hour: parts[1], dayOfMonth: parts[2], month: parts[3], dayOfWeek: parts[4] };
}

function scheduleRecipe(recipeId, cronExpression) {
  const parsed = parseCronExpression(cronExpression);
  if (!parsed) return { ok: false, error: 'Invalid cron expression' };
  const id = ++schedulerId;
  schedules.set(id, { recipeId, cron: cronExpression, parsed, active: true, createdAt: new Date().toISOString() });
  return { ok: true, scheduleId: id };
}

function unscheduleRecipe(scheduleId) {
  return schedules.delete(Number(scheduleId));
}

function getScheduledRecipes() {
  return Array.from(schedules.entries()).map(([id, s]) => ({ scheduleId: id, ...s }));
}

function getSchedulesForRecipe(recipeId) {
  return Array.from(schedules.entries()).filter(([, s]) => s.recipeId === recipeId).map(([id, s]) => ({ scheduleId: id, ...s }));
}

function pauseSchedule(scheduleId) {
  const s = schedules.get(Number(scheduleId));
  if (!s) return false;
  s.active = false;
  return true;
}

function resumeSchedule(scheduleId) {
  const s = schedules.get(Number(scheduleId));
  if (!s) return false;
  s.active = true;
  return true;
}

function clearAll() {
  schedules.clear();
}

module.exports = { scheduleRecipe, unscheduleRecipe, getScheduledRecipes, getSchedulesForRecipe, pauseSchedule, resumeSchedule, clearAll };

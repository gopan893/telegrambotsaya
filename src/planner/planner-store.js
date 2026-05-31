'use strict';

const utils = require('./planner-utils');

const PLANNER_SESSIONS_KEY = 'planner_sessions';
const PLANNER_TASKS_KEY = 'planner_tasks';

function memoryBucket(services = {}) {
  if (!services.__plannerStore) services.__plannerStore = {};
  return services.__plannerStore;
}

async function loadPlannerData(key, defaultValue = [], services = {}) {
  try {
    if (services.storageManager?.safeRead) {
      const data = await services.storageManager.safeRead(key, defaultValue);
      return Array.isArray(defaultValue) ? (Array.isArray(data) ? data : defaultValue) : (data || defaultValue);
    }
  } catch (_) {}
  const bucket = memoryBucket(services);
  if (typeof bucket[key] === 'undefined') bucket[key] = defaultValue;
  return bucket[key];
}

async function savePlannerData(key, data, services = {}) {
  const clean = data;
  try {
    if (services.storageManager?.safeWrite) {
      await services.storageManager.safeWrite(key, clean);
      return clean;
    }
  } catch (_) {}
  memoryBucket(services)[key] = clean;
  return clean;
}

async function appendPlannerItem(key, item, limit = 1000, services = {}) {
  const list = await loadPlannerData(key, [], services);
  const next = Array.isArray(list) ? list.slice() : [];
  next.push(item);
  await savePlannerData(key, next.slice(-limit), services);
  return item;
}

function matchFilters(item = {}, filters = {}) {
  for (const [key, value] of Object.entries(filters || {})) {
    if (value === undefined || value === null || value === '') continue;
    if (key === 'includeArchived' || key === 'limit') continue;
    if (key === 'status' && String(value) === 'all') continue;
    if (String(item[key] || '') !== String(value)) return false;
  }
  if (!filters.includeArchived && (item.status === 'archived' || item.archivedAt)) return false;
  return true;
}

async function listPlannerItems(key, filters = {}, services = {}) {
  const list = await loadPlannerData(key, [], services);
  const limit = Number(filters.limit || 100);
  return utils.stableSortByUpdated(Array.isArray(list) ? list : [])
    .filter(item => matchFilters(item, filters))
    .slice(0, Number.isFinite(limit) ? Math.min(limit, 200) : 100);
}

async function getPlannerItem(key, id, services = {}) {
  const list = await loadPlannerData(key, [], services);
  return (Array.isArray(list) ? list : []).find(item => String(item.id) === String(id)) || null;
}

async function upsertPlannerItem(key, item, services = {}) {
  const list = await loadPlannerData(key, [], services);
  const next = Array.isArray(list) ? list.slice() : [];
  const index = next.findIndex(existing => existing.id === item.id);
  if (index >= 0) next[index] = { ...next[index], ...item, updatedAt: item.updatedAt || utils.nowIso() };
  else next.push(item);
  await savePlannerData(key, next, services);
  return index >= 0 ? next[index] : item;
}

async function updatePlannerItem(key, id, patch = {}, services = {}) {
  const existing = await getPlannerItem(key, id, services);
  if (!existing) return null;
  const updated = { ...existing, ...patch, updatedAt: patch.updatedAt || utils.nowIso() };
  return upsertPlannerItem(key, updated, services);
}

module.exports = {
  PLANNER_SESSIONS_KEY,
  PLANNER_TASKS_KEY,
  appendPlannerItem,
  getPlannerItem,
  listPlannerItems,
  loadPlannerData,
  savePlannerData,
  updatePlannerItem,
  upsertPlannerItem
};

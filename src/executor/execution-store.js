'use strict';

const utils = require('./executor-utils');

const EXECUTOR_PROPOSALS_KEY = 'executor_proposals';
const EXECUTOR_RUNS_KEY = 'executor_runs';

function bucket(services = {}) {
  if (!services.__executorStore) services.__executorStore = {};
  return services.__executorStore;
}

async function loadExecutionData(key, fallback = [], services = {}) {
  try {
    if (services.storageManager?.safeRead) {
      const value = await services.storageManager.safeRead(key, fallback);
      return Array.isArray(fallback) ? (Array.isArray(value) ? value : fallback) : (value || fallback);
    }
  } catch (_) {}
  const memory = bucket(services);
  if (typeof memory[key] === 'undefined') memory[key] = fallback;
  return memory[key];
}

async function saveExecutionData(key, data, services = {}) {
  try {
    if (services.storageManager?.safeWrite) {
      await services.storageManager.safeWrite(key, data);
      return data;
    }
  } catch (_) {}
  bucket(services)[key] = data;
  return data;
}

function matches(item = {}, filters = {}) {
  for (const [key, value] of Object.entries(filters || {})) {
    if (['limit', 'includeExpired'].includes(key)) continue;
    if (value === undefined || value === null || value === '' || value === 'all') continue;
    if (String(item[key] || '') !== String(value)) return false;
  }
  if (!filters.includeExpired && item.status === 'expired') return false;
  return true;
}

async function listExecutionItems(key, filters = {}, services = {}) {
  const list = await loadExecutionData(key, [], services);
  const limit = Math.min(Number(filters.limit || 100), 200);
  return (Array.isArray(list) ? list : [])
    .filter(item => matches(item, filters))
    .sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')))
    .slice(0, Number.isFinite(limit) ? limit : 100);
}

async function getExecutionItem(key, id, services = {}) {
  const list = await loadExecutionData(key, [], services);
  return (Array.isArray(list) ? list : []).find(item => String(item.id) === String(id)) || null;
}

async function upsertExecutionItem(key, item, services = {}) {
  const list = await loadExecutionData(key, [], services);
  const next = Array.isArray(list) ? list.slice() : [];
  const index = next.findIndex(existing => existing.id === item.id);
  const value = { ...item, updatedAt: item.updatedAt || utils.nowIso() };
  if (index >= 0) next[index] = { ...next[index], ...value };
  else next.push(value);
  await saveExecutionData(key, next, services);
  return index >= 0 ? next[index] : value;
}

async function updateExecutionItem(key, id, patch = {}, services = {}) {
  const existing = await getExecutionItem(key, id, services);
  if (!existing) return null;
  return upsertExecutionItem(key, { ...existing, ...patch, updatedAt: patch.updatedAt || utils.nowIso() }, services);
}

async function appendExecutionItem(key, item, limit = 1000, services = {}) {
  const list = await loadExecutionData(key, [], services);
  const next = Array.isArray(list) ? list.slice() : [];
  next.push(item);
  await saveExecutionData(key, next.slice(-limit), services);
  return item;
}

module.exports = {
  EXECUTOR_PROPOSALS_KEY,
  EXECUTOR_RUNS_KEY,
  appendExecutionItem,
  getExecutionItem,
  listExecutionItems,
  loadExecutionData,
  saveExecutionData,
  updateExecutionItem,
  upsertExecutionItem
};

'use strict';

const utils = require('./research-utils');

const RESEARCH_TASKS_KEY = 'research_tasks';
const RESEARCH_REPORTS_KEY = 'research_reports';
const RESEARCH_DOC_PLANS_KEY = 'research_doc_update_plans';

function memoryBucket(services = {}) {
  if (!services.__researchStore) services.__researchStore = {};
  return services.__researchStore;
}

async function loadResearchData(key, defaultValue = [], services = {}) {
  try {
    if (services.storageManager?.safeRead) {
      const data = await services.storageManager.safeRead(key, defaultValue);
      return data === undefined || data === null ? defaultValue : data;
    }
    if (services.storageManager?.loadData) {
      const data = await services.storageManager.loadData(key, defaultValue);
      return data === undefined || data === null ? defaultValue : data;
    }
  } catch (_) {}
  const bucket = memoryBucket(services);
  if (typeof bucket[key] === 'undefined') bucket[key] = defaultValue;
  return bucket[key];
}

async function saveResearchData(key, data, services = {}) {
  const clean = utils.sanitizePayload(data, { maxString: 1600, maxItems: 2000, maxKeys: 120 });
  try {
    if (services.storageManager?.safeWrite) {
      await services.storageManager.safeWrite(key, clean);
      return clean;
    }
    if (services.storageManager?.saveData) {
      await services.storageManager.saveData(key, clean);
      return clean;
    }
  } catch (_) {}
  memoryBucket(services)[key] = clean;
  return clean;
}

async function listResearchItems(key, filters = {}, services = {}) {
  const list = await loadResearchData(key, [], services);
  const limit = Math.min(Number(filters.limit || 50), 200);
  return (Array.isArray(list) ? list : [])
    .filter((item) => !filters.workspaceId || String(item.workspaceId || '') === String(filters.workspaceId))
    .filter((item) => !filters.userId || String(item.userId || '') === String(filters.userId))
    .filter((item) => !filters.status || String(item.status || '') === String(filters.status))
    .filter((item) => !filters.scope || String(item.scope || '') === String(filters.scope))
    .sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')))
    .slice(0, Number.isFinite(limit) ? limit : 50);
}

async function getResearchItem(key, id, services = {}) {
  const list = await loadResearchData(key, [], services);
  return (Array.isArray(list) ? list : []).find((item) => String(item.id) === String(id)) || null;
}

async function upsertResearchItem(key, item, services = {}) {
  const list = await loadResearchData(key, [], services);
  const next = Array.isArray(list) ? list.slice() : [];
  const value = utils.sanitizePayload({ ...item, updatedAt: item.updatedAt || utils.nowIso() }, { maxString: 1600, maxItems: 2000, maxKeys: 120 });
  const index = next.findIndex((existing) => String(existing.id) === String(value.id));
  if (index >= 0) next[index] = { ...next[index], ...value };
  else next.push(value);
  await saveResearchData(key, next.slice(-1000), services);
  return index >= 0 ? next[index] : value;
}

async function appendResearchItem(key, item, limit = 1000, services = {}) {
  const list = await loadResearchData(key, [], services);
  const next = Array.isArray(list) ? list.slice() : [];
  next.push(utils.sanitizePayload(item, { maxString: 1600, maxItems: 2000, maxKeys: 120 }));
  await saveResearchData(key, next.slice(-limit), services);
  return item;
}

module.exports = {
  RESEARCH_DOC_PLANS_KEY,
  RESEARCH_REPORTS_KEY,
  RESEARCH_TASKS_KEY,
  appendResearchItem,
  getResearchItem,
  listResearchItems,
  loadResearchData,
  saveResearchData,
  upsertResearchItem
};


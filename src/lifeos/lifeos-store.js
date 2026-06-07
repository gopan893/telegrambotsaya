'use strict';

const utils = require('./lifeos-utils');

const LIFEOS_ITEMS_KEY = 'lifeos_items';
const LIFEOS_PROPOSALS_KEY = 'lifeos_proposals';
const LIFEOS_MEMORY_KEY = 'lifeos_memory';

function bucket(services = {}) {
  if (!services.__lifeosStore) services.__lifeosStore = {};
  return services.__lifeosStore;
}

async function loadLifeData(key, defaultValue = [], services = {}) {
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
  const memory = bucket(services);
  if (typeof memory[key] === 'undefined') memory[key] = defaultValue;
  return memory[key];
}

async function saveLifeData(key, data, services = {}) {
  const clean = utils.sanitizePayload(data, { maxString: 1400, maxItems: 3000, maxKeys: 140 });
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
  bucket(services)[key] = clean;
  return clean;
}

async function listLifeItems(filters = {}, services = {}) {
  const items = await loadLifeData(LIFEOS_ITEMS_KEY, [], services);
  const limit = Math.min(Math.max(Number(filters.limit || 100), 1), 500);
  return (Array.isArray(items) ? items : [])
    .filter((item) => !filters.workspaceId || String(item.workspaceId || '') === String(filters.workspaceId))
    .filter((item) => !filters.userId || String(item.userId || '') === String(filters.userId))
    .filter((item) => !filters.type || String(item.type || '') === String(filters.type))
    .filter((item) => !filters.status || String(item.status || '') === String(filters.status))
    .filter((item) => !filters.date || String(item.scheduledAt || item.dueAt || '').slice(0, 10) === String(filters.date))
    .filter((item) => !filters.includeArchived ? item.status !== 'archived' : true)
    .sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')))
    .slice(0, limit);
}

async function getLifeItem(id, services = {}) {
  const items = await loadLifeData(LIFEOS_ITEMS_KEY, [], services);
  return (Array.isArray(items) ? items : []).find((item) => String(item.id) === String(id)) || null;
}

async function upsertLifeItem(item, services = {}) {
  const items = await loadLifeData(LIFEOS_ITEMS_KEY, [], services);
  const next = Array.isArray(items) ? items.slice() : [];
  const clean = utils.sanitizePayload({ ...item, updatedAt: item.updatedAt || utils.nowIso() }, { maxString: 1400, maxItems: 3000, maxKeys: 140 });
  const index = next.findIndex((existing) => String(existing.id) === String(clean.id));
  if (index >= 0) next[index] = { ...next[index], ...clean };
  else next.push(clean);
  await saveLifeData(LIFEOS_ITEMS_KEY, next.slice(-2000), services);
  return index >= 0 ? next[index] : clean;
}

async function appendLifeProposal(proposal, services = {}) {
  const list = await loadLifeData(LIFEOS_PROPOSALS_KEY, [], services);
  const next = Array.isArray(list) ? list.slice() : [];
  const clean = utils.sanitizePayload(proposal, { maxString: 1400, maxItems: 500, maxKeys: 120 });
  next.push(clean);
  await saveLifeData(LIFEOS_PROPOSALS_KEY, next.slice(-1000), services);
  return clean;
}

async function listLifeProposals(filters = {}, services = {}) {
  const list = await loadLifeData(LIFEOS_PROPOSALS_KEY, [], services);
  const limit = Math.min(Math.max(Number(filters.limit || 50), 1), 200);
  return (Array.isArray(list) ? list : [])
    .filter((item) => !filters.workspaceId || String(item.workspaceId || '') === String(filters.workspaceId))
    .filter((item) => !filters.userId || String(item.userId || '') === String(filters.userId))
    .filter((item) => !filters.status || String(item.status || '') === String(filters.status))
    .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
    .slice(0, limit);
}

async function getLifeOsStorageStatus(services = {}) {
  let storage = {};
  try {
    storage = services.storageManager?.getStorageStatus?.() || {};
  } catch (_) {}
  return utils.sanitizePayload({
    activeDriver: storage.activeDriver || storage.storageDriver || 'memory',
    fallbackActive: Boolean(storage.fallbackActive),
    postgresAvailable: Boolean(storage.postgresAvailable),
    redisAvailable: Boolean(storage.redisAvailable)
  });
}

module.exports = {
  LIFEOS_ITEMS_KEY,
  LIFEOS_MEMORY_KEY,
  LIFEOS_PROPOSALS_KEY,
  appendLifeProposal,
  getLifeItem,
  getLifeOsStorageStatus,
  listLifeItems,
  listLifeProposals,
  loadLifeData,
  saveLifeData,
  upsertLifeItem
};

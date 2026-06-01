'use strict';

const utils = require('./backup-utils');

function memoryBucket(services = {}) {
  if (!services.__backupStore) services.__backupStore = {};
  return services.__backupStore;
}

async function loadBackupData(key, defaultValue = [], services = {}) {
  try {
    if (services.storageManager?.safeRead) {
      const value = await services.storageManager.safeRead(key, defaultValue);
      return Array.isArray(defaultValue) ? (Array.isArray(value) ? value : defaultValue) : (value || defaultValue);
    }
  } catch (_) {}
  const bucket = memoryBucket(services);
  if (typeof bucket[key] === 'undefined') bucket[key] = defaultValue;
  return bucket[key];
}

async function saveBackupData(key, data, services = {}) {
  try {
    if (services.storageManager?.safeWrite) {
      await services.storageManager.safeWrite(key, data);
      return data;
    }
  } catch (_) {}
  memoryBucket(services)[key] = data;
  return data;
}

async function appendBackupItem(key, item, limit = 1000, services = {}) {
  const list = await loadBackupData(key, [], services);
  const next = Array.isArray(list) ? list.slice() : [];
  next.push(item);
  await saveBackupData(key, next.slice(-limit), services);
  return item;
}

function matches(item = {}, filters = {}) {
  for (const [key, value] of Object.entries(filters || {})) {
    if (['limit', 'includeArchived'].includes(key)) continue;
    if (value === undefined || value === null || value === '' || value === 'all') continue;
    if (String(item[key] || '') !== String(value)) return false;
  }
  if (!filters.includeArchived && item.status === 'archived') return false;
  return true;
}

async function listBackupItems(key, filters = {}, services = {}) {
  const list = await loadBackupData(key, [], services);
  const limit = Math.min(Number(filters.limit || 50), 200);
  return (Array.isArray(list) ? list : [])
    .filter(item => matches(item, filters))
    .sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')))
    .slice(0, Number.isFinite(limit) ? limit : 50);
}

async function getBackupItem(key, id, services = {}) {
  const list = await loadBackupData(key, [], services);
  return (Array.isArray(list) ? list : []).find(item => String(item.id) === String(id)) || null;
}

async function upsertBackupItem(key, item, services = {}) {
  const list = await loadBackupData(key, [], services);
  const next = Array.isArray(list) ? list.slice() : [];
  const index = next.findIndex(existing => existing.id === item.id);
  const value = { ...item, updatedAt: item.updatedAt || utils.nowIso() };
  if (index >= 0) next[index] = { ...next[index], ...value };
  else next.push(value);
  await saveBackupData(key, next, services);
  return index >= 0 ? next[index] : value;
}

async function updateBackupItem(key, id, patch = {}, services = {}) {
  const existing = await getBackupItem(key, id, services);
  if (!existing) return null;
  return upsertBackupItem(key, { ...existing, ...patch, updatedAt: utils.nowIso() }, services);
}

function getBackupStorageStatus(services = {}) {
  try {
    const status = services.storageManager?.getStorageStatus?.() || {};
    return utils.sanitize({
      activeDriver: status.activeDriver || status.driver || status.storageDriver || 'unknown',
      configuredDriver: status.configuredDriver || status.preferredDriver || 'auto',
      postgresAvailable: Boolean(status.postgresAvailable || status.postgres?.available),
      postgresTableReady: Boolean(status.postgresTableReady || status.postgres?.tableReady),
      redisAvailable: Boolean(status.redisAvailable || status.redis?.available || status.cache?.redisAvailable),
      fallbackActive: Boolean(status.fallbackActive || status.fallback),
      fallbackReason: status.fallbackReason || '',
      jsonFallbackAvailable: status.jsonFallbackAvailable !== false
    });
  } catch (err) {
    return { activeDriver: 'unknown', fallbackActive: true, error: err.message };
  }
}

module.exports = {
  appendBackupItem,
  getBackupItem,
  getBackupStorageStatus,
  listBackupItems,
  loadBackupData,
  saveBackupData,
  updateBackupItem,
  upsertBackupItem
};

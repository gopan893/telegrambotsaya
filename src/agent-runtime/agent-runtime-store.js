'use strict';

const RUNTIME_STORE_KEY = 'agent_runtime_store';

function memoryBucket(services = {}) {
  if (!services.__agentRuntimeStore) services.__agentRuntimeStore = {};
  return services.__agentRuntimeStore;
}

async function loadData(key, defaultValue = [], services = {}) {
  try {
    if (services.storageManager?.safeRead) {
      const data = await services.storageManager.safeRead(key, defaultValue);
      return data === undefined || data === null ? defaultValue : data;
    }
  } catch (_) {}
  const bucket = memoryBucket(services);
  if (typeof bucket[key] === 'undefined') bucket[key] = defaultValue;
  return bucket[key];
}

async function saveData(key, data, services = {}) {
  try {
    if (services.storageManager?.safeWrite) {
      await services.storageManager.safeWrite(key, data);
      return data;
    }
  } catch (_) {}
  memoryBucket(services)[key] = data;
  return data;
}

async function loadRuntimeStore(services = {}) {
  const defaults = { profiles: [], loadSnapshots: [], healthChecks: [], regressions: [], reports: [] };
  return loadData(RUNTIME_STORE_KEY, defaults, services);
}

async function saveRuntimeStore(store, services = {}) {
  return saveData(RUNTIME_STORE_KEY, store, services);
}

async function addRecord(category, record, services = {}) {
  const store = await loadRuntimeStore(services);
  if (!Array.isArray(store[category])) store[category] = [];
  store[category].push(record);
  await saveRuntimeStore(store, services);
  return record;
}

async function getRecords(category, filterFn, services = {}) {
  const store = await loadRuntimeStore(services);
  const arr = Array.isArray(store[category]) ? store[category] : [];
  return typeof filterFn === 'function' ? arr.filter(filterFn) : arr;
}

module.exports = { loadRuntimeStore, saveRuntimeStore, addRecord, getRecords, loadData, saveData };

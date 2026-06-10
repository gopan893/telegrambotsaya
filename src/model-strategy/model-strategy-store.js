'use strict';

const STRATEGY_STORE_KEY = 'model_strategy_store';

function memoryBucket(services = {}) {
  if (!services.__modelStrategyStore) services.__modelStrategyStore = {};
  return services.__modelStrategyStore;
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

async function loadStrategyStore(services = {}) {
  const defaults = { strategies: [], routingDecisions: [], benchmarks: [], costRecords: [], latencyRecords: [] };
  return loadData(STRATEGY_STORE_KEY, defaults, services);
}

async function saveStrategyStore(store, services = {}) {
  return saveData(STRATEGY_STORE_KEY, store, services);
}

async function addRecord(category, record, services = {}) {
  const s = await loadStrategyStore(services);
  if (!Array.isArray(s[category])) s[category] = [];
  s[category].push(record);
  await saveStrategyStore(s, services);
  return record;
}

async function getRecords(category, filterFn, services = {}) {
  const s = await loadStrategyStore(services);
  const arr = Array.isArray(s[category]) ? s[category] : [];
  return typeof filterFn === 'function' ? arr.filter(filterFn) : arr;
}

module.exports = { loadStrategyStore, saveStrategyStore, addRecord, getRecords, loadData, saveData };

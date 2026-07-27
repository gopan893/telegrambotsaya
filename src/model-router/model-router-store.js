'use strict';

const utils = require('./model-router-utils');

const MODEL_STORE_KEY = 'model_router_store';

function memoryBucket(services = {}) {
  if (!services.__modelRouterStore) services.__modelRouterStore = {};
  return services.__modelRouterStore;
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

async function loadModelStore(services = {}) {
  return loadData(MODEL_STORE_KEY, { providers: [], capabilities: [], decisions: [], audits: [], benchmarks: [] }, services);
}

async function saveModelStore(store, services = {}) {
  return saveData(MODEL_STORE_KEY, store, services);
}

module.exports = { loadModelStore, saveModelStore, loadData, saveData };

'use strict';

const stores = new Map();
const items = new Map();

function registerStorageAccess(item) {
  if (!item || !item.id) return null;
  const now = new Date().toISOString();
  const entry = {
    id: item.id,
    module: item.module || 'unknown',
    storageType: item.storageType || 'unknown',
    accessType: item.accessType || 'read',
    required: !!item.required,
    fallbackAllowed: !!item.fallbackAllowed,
    fallbackType: item.fallbackType || null,
    sensitivity: item.sensitivity || 'low',
    ownerModule: item.ownerModule || null,
    status: item.status || 'active',
    createdAt: item.createdAt || now,
    updatedAt: now
  };
  stores.set(item.id, entry);
  if (!items.has(entry.module)) items.set(entry.module, []);
  const modList = items.get(entry.module);
  const idx = modList.findIndex(e => e.id === entry.id);
  if (idx === -1) modList.push(entry);
  else modList[idx] = entry;
  return entry;
}

function listStorageAccess(filters) {
  let result = Array.from(stores.values());
  if (filters) {
    if (filters.module) result = result.filter(e => e.module === filters.module);
    if (filters.storageType) result = result.filter(e => e.storageType === filters.storageType);
    if (filters.accessType) result = result.filter(e => e.accessType === filters.accessType);
    if (filters.status) result = result.filter(e => e.status === filters.status);
    if (filters.required !== undefined) result = result.filter(e => e.required === !!filters.required);
  }
  return result;
}

function getStorageAccessForModule(moduleName) {
  return items.get(moduleName) || [];
}

function clearAll() {
  stores.clear();
  items.clear();
}

module.exports = {
  registerStorageAccess,
  listStorageAccess,
  getStorageAccessForModule,
  clearAll
};

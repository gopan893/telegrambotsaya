'use strict';

const stores = new Map();

function storeKey(type, workspaceId) {
  return `${workspaceId}::${type}`;
}

function getRegistry(type, workspaceId) {
  const key = storeKey(type, workspaceId || 'default');
  if (!stores.has(key)) return [];
  return stores.get(key);
}

function setRegistry(type, items, workspaceId) {
  const key = storeKey(type, workspaceId || 'default');
  stores.set(key, items);
}

function getRegistryItem(id, type, workspaceId) {
  const registry = getRegistry(type, workspaceId);
  return registry.find(item => item.id === id) || null;
}

function addRegistryItem(item, type, workspaceId) {
  const key = storeKey(type, workspaceId || 'default');
  const registry = getRegistry(type, workspaceId);
  const existing = registry.findIndex(i => i.id === item.id);
  if (existing !== -1) {
    registry[existing] = item;
  } else {
    registry.push(item);
  }
  stores.set(key, registry);
}

function removeRegistryItem(id, type, workspaceId) {
  const key = storeKey(type, workspaceId || 'default');
  const registry = getRegistry(type, workspaceId);
  const filtered = registry.filter(i => i.id !== id);
  stores.set(key, filtered);
}

function clearAll(workspaceId) {
  const prefix = `${workspaceId || 'default'}::`;
  for (const key of stores.keys()) {
    if (key.startsWith(prefix)) stores.delete(key);
  }
}

module.exports = {
  getRegistry,
  setRegistry,
  getRegistryItem,
  addRegistryItem,
  removeRegistryItem,
  clearAll
};

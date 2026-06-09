'use strict';

const store = { plugins: new Map(), connectors: new Map() };

function getPlugin(pluginId) {
  return store.plugins.get(String(pluginId)) || null;
}

function setPlugin(pluginId, data) {
  store.plugins.set(String(pluginId), { ...data, id: pluginId, updatedAt: new Date().toISOString() });
  return getPlugin(pluginId);
}

function listPlugins(filter = {}) {
  let arr = Array.from(store.plugins.values());
  if (filter.type) arr = arr.filter(p => p.type === filter.type);
  if (filter.status) arr = arr.filter(p => p.status === filter.status);
  if (filter.enabled !== undefined) arr = arr.filter(p => p.enabled === filter.enabled);
  return arr;
}

function removePlugin(pluginId) {
  return store.plugins.delete(String(pluginId));
}

function getConnector(connectorId) {
  return store.connectors.get(String(connectorId)) || null;
}

function setConnector(connectorId, data) {
  store.connectors.set(String(connectorId), { ...data, id: connectorId, updatedAt: new Date().toISOString() });
  return getConnector(connectorId);
}

function listConnectors(filter = {}) {
  let arr = Array.from(store.connectors.values());
  if (filter.type) arr = arr.filter(c => c.type === filter.type);
  if (filter.status) arr = arr.filter(c => c.status === filter.status);
  if (filter.connected !== undefined) arr = arr.filter(c => c.connected === filter.connected);
  return arr;
}

function removeConnector(connectorId) {
  return store.connectors.delete(String(connectorId));
}

function getStats() {
  return {
    pluginCount: store.plugins.size,
    connectorCount: store.connectors.size,
    enabledPlugins: Array.from(store.plugins.values()).filter(p => p.enabled).length,
    connectedConnectors: Array.from(store.connectors.values()).filter(c => c.connected).length
  };
}

function resetStore() {
  store.plugins.clear();
  store.connectors.clear();
}

module.exports = { getPlugin, setPlugin, listPlugins, removePlugin, getConnector, setConnector, listConnectors, removeConnector, getStats, resetStore };

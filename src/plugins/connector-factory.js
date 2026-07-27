'use strict';

const registry = require('./connector-registry');
const store = require('./plugin-store');

function createConnectorInstance(connectorId, config = {}) {
  const template = registry.findConnectorRegistry(connectorId);
  if (!template) return null;
  const instance = {
    id: `${connectorId}_${Date.now()}`,
    connectorId,
    name: template.name,
    type: template.type,
    category: template.category,
    config: { ...config },
    status: 'disconnected',
    connected: false,
    createdAt: new Date().toISOString(),
    lastError: null
  };
  store.setConnector(instance.id, instance);
  return instance;
}

async function connectConnector(connectorId, authConfig = {}) {
  const instance = store.getConnector(connectorId);
  if (!instance) return { ok: false, error: 'Connector not found' };
  if (instance.connected) return { ok: true, status: 'already_connected' };
  instance.status = 'connecting';
  store.setConnector(connectorId, instance);
  try {
    instance.status = 'connected';
    instance.connected = true;
    instance.lastConnected = new Date().toISOString();
    store.setConnector(connectorId, instance);
    return { ok: true, instance };
  } catch (err) {
    instance.status = 'error';
    instance.lastError = err.message;
    store.setConnector(connectorId, instance);
    return { ok: false, error: err.message };
  }
}

async function disconnectConnector(connectorId) {
  const instance = store.getConnector(connectorId);
  if (!instance) return { ok: false, error: 'Connector not found' };
  instance.status = 'disconnected';
  instance.connected = false;
  instance.lastDisconnected = new Date().toISOString();
  store.setConnector(connectorId, instance);
  return { ok: true };
}

function getConnectorAuthSchema(connectorId) {
  const template = registry.findConnectorRegistry(connectorId);
  if (!template) return null;
  return { authMethods: template.authMethods, type: template.type, category: template.category };
}

module.exports = { createConnectorInstance, connectConnector, disconnectConnector, getConnectorAuthSchema };

'use strict';

const store = require('./plugin-store');

async function checkConnectorHealth(connectorId) {
  const instance = store.getConnector(connectorId);
  if (!instance) return { ok: false, error: 'Connector not found' };
  return {
    id: instance.id,
    connectorId: instance.connectorId,
    status: instance.status,
    connected: instance.connected,
    lastConnected: instance.lastConnected || null,
    lastError: instance.lastError || null,
    uptime: instance.connected ? Math.floor((Date.now() - new Date(instance.lastConnected || Date.now()).getTime()) / 1000) : 0
  };
}

async function checkAllConnectorsHealth() {
  const connectors = store.listConnectors();
  const results = [];
  for (const c of connectors) {
    const health = await checkConnectorHealth(c.id);
    results.push(health);
  }
  return {
    total: results.length,
    connected: results.filter(r => r.connected).length,
    disconnected: results.filter(r => !r.connected && r.status !== 'error').length,
    errored: results.filter(r => r.status === 'error').length,
    connectors: results
  };
}

module.exports = { checkConnectorHealth, checkAllConnectorsHealth };

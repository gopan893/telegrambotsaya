'use strict';

const utils = require('./local-integration-utils');

const store = {
  tunnels: new Map(),
  healthHistory: new Map()
};

const TUNNEL_STATUSES = ['active', 'inactive', 'error', 'expired', 'unknown'];

function registerTunnel(params) {
  if (!params || !params.id || !params.name) {
    return { ok: false, error: 'Missing id or name' };
  }
  const tunnel = {
    id: params.id,
    name: params.name,
    url: params.url ? utils.sanitizeTunnelUrl(params.url) : '',
    type: params.type || 'cloudflare',
    status: 'unknown',
    lastCheckAt: null,
    errorCount: 0,
    consecutiveFailures: 0,
    metadata: params.metadata || {},
    createdAt: new Date().toISOString()
  };
  store.tunnels.set(params.id, tunnel);
  return { ok: true, tunnel };
}

function getTunnel(tunnelId) {
  return store.tunnels.get(String(tunnelId)) || null;
}

function listTunnels(filter) {
  let arr = Array.from(store.tunnels.values());
  if (filter && filter.status) arr = arr.filter(t => t.status === filter.status);
  return arr;
}

function recordHealthCheck(tunnelId, status, message) {
  const tunnel = store.tunnels.get(String(tunnelId));
  if (!tunnel) return { ok: false, error: 'Tunnel not found' };

  const validStatus = TUNNEL_STATUSES.includes(status) ? status : 'unknown';
  tunnel.status = validStatus;
  tunnel.lastCheckAt = new Date().toISOString();
  if (validStatus === 'active') tunnel.consecutiveFailures = 0;
  else if (validStatus === 'error') tunnel.consecutiveFailures++;

  const history = store.healthHistory.get(String(tunnelId)) || [];
  history.push({ status: validStatus, message: message || '', at: new Date().toISOString() });
  if (history.length > 100) history.splice(0, history.length - 100);
  store.healthHistory.set(String(tunnelId), history);

  store.tunnels.set(String(tunnelId), tunnel);
  return { ok: true, tunnel };
}

function getHealthHistory(tunnelId) {
  return store.healthHistory.get(String(tunnelId)) || [];
}

function getTunnelStatus(tunnelId) {
  const tunnel = store.tunnels.get(String(tunnelId));
  if (!tunnel) return { ok: false, error: 'Tunnel not found' };
  return {
    ok: true,
    tunnelId: tunnel.id,
    name: tunnel.name,
    url: tunnel.url,
    status: tunnel.status,
    lastCheckAt: tunnel.lastCheckAt,
    consecutiveFailures: tunnel.consecutiveFailures
  };
}

function detectInactiveTunnels(threshold) {
  const t = threshold || 3;
  return Array.from(store.tunnels.values()).filter(tun => tun.consecutiveFailures >= t || tun.status === 'inactive');
}

function getMonitorStats() {
  const tunnels = Array.from(store.tunnels.values());
  const stats = { total: tunnels.length, active: 0, inactive: 0, error: 0, expired: 0, unknown: 0 };
  for (const t of tunnels) stats[t.status] = (stats[t.status] || 0) + 1;
  return stats;
}

function removeTunnel(tunnelId) {
  const exists = store.tunnels.get(String(tunnelId));
  if (!exists) return { ok: false, error: 'Tunnel not found' };
  store.tunnels.delete(String(tunnelId));
  store.healthHistory.delete(String(tunnelId));
  return { ok: true };
}

function resetMonitor() {
  store.tunnels.clear();
  store.healthHistory.clear();
}

module.exports = {
  registerTunnel, getTunnel, listTunnels,
  recordHealthCheck, getHealthHistory, getTunnelStatus,
  detectInactiveTunnels, getMonitorStats, removeTunnel,
  resetMonitor, TUNNEL_STATUSES
};

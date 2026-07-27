'use strict';

const utils = require('./reliability-utils');

const DEFAULT_SLOS = [
  { name: 'app_uptime', target: 99, window: '24h', severity: 'critical', enabled: true, module: 'core' },
  { name: 'dashboard_availability', target: 99, window: '24h', severity: 'high', enabled: true, module: 'dashboard' },
  { name: 'telegram_response_success', target: 98, window: '24h', severity: 'high', enabled: true, module: 'telegram' },
  { name: 'webhook_success', target: 98, window: '24h', severity: 'high', enabled: true, module: 'webhook' },
  { name: 'render_health', target: 99, window: '24h', severity: 'critical', enabled: true, module: 'deploy' },
  { name: 'postgres_health', target: 99.5, window: '24h', severity: 'critical', enabled: true, module: 'storage' },
  { name: 'redis_health', target: 99, window: '24h', severity: 'high', enabled: true, module: 'storage' },
  { name: 'deploy_success', target: 100, window: '30d', severity: 'critical', enabled: true, module: 'deploy' },
  { name: 'incident_response_time', target: 60, window: '30d', severity: 'high', enabled: true, module: 'incident' },
  { name: 'approval_boundary_integrity', target: 100, window: '30d', severity: 'critical', enabled: true, module: 'governance' },
  { name: 'secret_leak_zero', target: 100, window: '30d', severity: 'critical', enabled: true, module: 'security' },
  { name: 'dashboard_route_integrity', target: 100, window: '30d', severity: 'high', enabled: true, module: 'dashboard' },
];

function createInitialStore() {
  return { slos: [] };
}

let store = createInitialStore();

function resetStore() { store = createInitialStore(); return store; }
function getStore() { return store; }

function initializeDefaultSlos() {
  if (store.slos.length > 0) return store.slos;
  for (const s of DEFAULT_SLOS) {
    store.slos.push({ id: utils.generateId('slo'), ...s, createdAt: utils.formatTimestamp() });
  }
  return store.slos;
}

function getSlo(id) { return store.slos.find(s => s.id === id) || null; }

function listSlos(filter = {}) {
  let items = [...store.slos];
  if (filter.module) items = items.filter(s => s.module === filter.module);
  if (filter.enabled !== undefined) items = items.filter(s => s.enabled === filter.enabled);
  if (filter.severity) items = items.filter(s => s.severity === filter.severity);
  return items;
}

function updateSlo(id, patch = {}) {
  const idx = store.slos.findIndex(s => s.id === id);
  if (idx === -1) return null;
  const forbidden = ['id', 'createdAt'];
  for (const key of forbidden) delete patch[key];
  store.slos[idx] = { ...store.slos[idx], ...patch };
  return store.slos[idx];
}

function addCustomSlo(input = {}) {
  const slo = {
    id: utils.generateId('slo'),
    name: input.name || 'custom_slo',
    target: utils.safeNumber(input.target, 99),
    window: input.window || '24h',
    severity: input.severity || 'low',
    enabled: input.enabled !== false,
    module: input.module || 'custom',
    createdAt: utils.formatTimestamp()
  };
  store.slos.push(slo);
  return slo;
}

module.exports = {
  resetStore, getStore, initializeDefaultSlos, getSlo, listSlos, updateSlo, addCustomSlo, DEFAULT_SLOS
};

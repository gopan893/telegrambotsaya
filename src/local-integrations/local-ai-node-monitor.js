'use strict';

const store = {
  endpoints: new Map(),
  healthHistory: new Map(),
  metrics: new Map()
};

const HEALTH_STATES = ['healthy', 'degraded', 'unhealthy', 'unknown'];

function registerEndpoint(params) {
  if (!params || !params.id || !params.name) {
    return { ok: false, error: 'Missing id or name' };
  }
  const endpoint = {
    id: params.id,
    name: params.name,
    url: params.url || '',
    type: params.type || 'local_llm',
    status: 'unknown',
    lastCheckAt: null,
    lastHealthyAt: null,
    errorCount: 0,
    consecutiveFailures: 0,
    metrics: { latencyMs: 0, requestsTotal: 0, failuresTotal: 0 },
    metadata: params.metadata || {},
    createdAt: new Date().toISOString()
  };
  store.endpoints.set(params.id, endpoint);
  return { ok: true, endpoint };
}

function getEndpoint(endpointId) {
  return store.endpoints.get(String(endpointId)) || null;
}

function listEndpoints(filter) {
  let arr = Array.from(store.endpoints.values());
  if (filter && filter.status) arr = arr.filter(e => e.status === filter.status);
  return arr;
}

function recordHealthCheck(endpointId, status, message) {
  const endpoint = store.endpoints.get(String(endpointId));
  if (!endpoint) return { ok: false, error: 'Endpoint not found' };

  const validStatus = HEALTH_STATES.includes(status) ? status : 'unknown';
  endpoint.status = validStatus;
  endpoint.lastCheckAt = new Date().toISOString();
  if (validStatus === 'healthy') {
    endpoint.consecutiveFailures = 0;
    endpoint.lastHealthyAt = new Date().toISOString();
  } else if (validStatus === 'unhealthy') {
    endpoint.consecutiveFailures++;
  }

  const history = store.healthHistory.get(String(endpointId)) || [];
  history.push({ status: validStatus, message: message || '', at: new Date().toISOString() });
  if (history.length > 100) history.splice(0, history.length - 100);
  store.healthHistory.set(String(endpointId), history);

  store.endpoints.set(String(endpointId), endpoint);
  return { ok: true, endpoint };
}

function getHealthHistory(endpointId) {
  return store.healthHistory.get(String(endpointId)) || [];
}

function detectUnhealthyEndpoints(threshold) {
  const t = threshold || 3;
  return Array.from(store.endpoints.values()).filter(e => e.consecutiveFailures >= t);
}

function getMonitorStats() {
  const endpoints = Array.from(store.endpoints.values());
  const stats = { total: endpoints.length, healthy: 0, degraded: 0, unhealthy: 0, unknown: 0 };
  for (const e of endpoints) stats[e.status] = (stats[e.status] || 0) + 1;
  return stats;
}

function removeEndpoint(endpointId) {
  const exists = store.endpoints.get(String(endpointId));
  if (!exists) return { ok: false, error: 'Endpoint not found' };
  store.endpoints.delete(String(endpointId));
  store.healthHistory.delete(String(endpointId));
  store.metrics.delete(String(endpointId));
  return { ok: true };
}

function resetMonitor() {
  store.endpoints.clear();
  store.healthHistory.clear();
  store.metrics.clear();
}

module.exports = {
  registerEndpoint, getEndpoint, listEndpoints,
  recordHealthCheck, getHealthHistory, detectUnhealthyEndpoints,
  getMonitorStats, removeEndpoint, resetMonitor, HEALTH_STATES
};

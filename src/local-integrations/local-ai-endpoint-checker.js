'use strict';

const monitor = require('./local-ai-node-monitor');

function checkEndpointHealth(endpointId) {
  const endpoint = monitor.getEndpoint(endpointId);
  if (!endpoint) return { ok: false, error: 'Endpoint not found' };

  const result = {
    endpointId,
    name: endpoint.name,
    status: endpoint.status,
    healthy: endpoint.status === 'healthy',
    lastCheckAt: endpoint.lastCheckAt,
    consecutiveFailures: endpoint.consecutiveFailures,
    latencyMs: endpoint.metrics.latencyMs,
    checkedAt: new Date().toISOString()
  };

  return { ok: true, result };
}

function checkEndpointLatency(endpointId) {
  const endpoint = monitor.getEndpoint(endpointId);
  if (!endpoint) return { ok: false, error: 'Endpoint not found' };

  return {
    ok: true,
    endpointId,
    latencyMs: endpoint.metrics.latencyMs,
    averageLatency: endpoint.metrics.latencyMs,
    status: endpoint.status
  };
}

function batchCheckHealth(endpointIds) {
  const results = [];
  for (const id of endpointIds) {
    results.push(checkEndpointHealth(id));
  }
  const healthy = results.filter(r => r.ok && r.result && r.result.healthy).length;
  const unhealthy = results.filter(r => r.ok && r.result && !r.result.healthy).length;
  return { ok: true, results, healthy, unhealthy, total: results.length };
}

function checkAllEndpoints() {
  const endpoints = monitor.listEndpoints();
  return batchCheckHealth(endpoints.map(e => e.id));
}

function getEndpointSummary(endpointId) {
  const endpoint = monitor.getEndpoint(endpointId);
  if (!endpoint) return { ok: false, error: 'Endpoint not found' };
  return {
    ok: true,
    summary: {
      id: endpoint.id,
      name: endpoint.name,
      status: endpoint.status,
      healthy: endpoint.status === 'healthy',
      latencyMs: endpoint.metrics.latencyMs,
      errorCount: endpoint.errorCount,
      consecutiveFailures: endpoint.consecutiveFailures,
      lastCheckAt: endpoint.lastCheckAt,
      lastHealthyAt: endpoint.lastHealthyAt
    }
  };
}

module.exports = {
  checkEndpointHealth, checkEndpointLatency,
  batchCheckHealth, checkAllEndpoints, getEndpointSummary
};

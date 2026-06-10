'use strict';

const path = require('path');
const utils = require('./performance-utils');

const BASE = path.join(process.cwd());
const DASHBOARD_ROUTES_PATH = path.join(BASE, 'src', 'dashboard', 'dashboard-routes.js');

function profileDashboardApiResponses(services = {}) {
  const content = utils.readFileSafe(DASHBOARD_ROUTES_PATH);
  if (!content) return { endpoints: [] };

  const endpoints = [];
  const routeRegex = /router\.(get|post|put|delete|patch)\(['"`]([^'"`]+)['"`]/g;
  let match;
  while ((match = routeRegex.exec(content)) !== null) {
    const method = match[1].toUpperCase();
    const route = match[2];
    endpoints.push({ method, route, handler: 'async' });
  }

  return {
    totalEndpoints: endpoints.length,
    endpoints,
    file: 'src/dashboard/dashboard-routes.js'
  };
}

function detectSlowDashboardApiRisk(services = {}) {
  const profile = profileDashboardApiResponses(services);
  const risks = [];

  const heavyRoutes = [
    '/summary', '/storage', '/ops', '/benchmarks',
    '/user/:userId/overview', '/user/:userId/memories',
    '/user/:userId/goals', '/user/:userId/workflows',
    '/user/:userId/insights', '/user/:userId/graph'
  ];

  for (const ep of profile.endpoints) {
    if (heavyRoutes.includes(ep.route)) {
      risks.push({
        endpoint: `${ep.method} ${ep.route}`,
        risk: 'potential_slow',
        reason: 'Aggregates multiple data sources or performs heavy computation'
      });
    }
  }

  return {
    risks,
    totalRisks: risks.length,
    note: 'Static analysis only - no real load testing performed'
  };
}

function detectLargeDashboardApiPayloads(services = {}) {
  const content = utils.readFileSafe(DASHBOARD_ROUTES_PATH);
  if (!content) return { largePayloads: [] };

  const largePayloads = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('serializers.sanitize') && (line.includes('.map(') || line.includes('items:'))) {
      const routeMatch = lines[Math.max(0, i - 3)]?.match(/router\.\w+\(['"`]([^'"`]+)/);
      if (routeMatch) {
        largePayloads.push({
          route: routeMatch[1],
          line: i + 1,
          indicator: 'Array mapping with serializer sanitization',
          estimation: 'Potential large payload if unbounded'
        });
      }
    }
  }

  return { largePayloads };
}

function buildApiResponsePerformanceReport(services = {}) {
  const profile = profileDashboardApiResponses(services);
  const slowRisks = detectSlowDashboardApiRisk(services);
  const largePayloads = detectLargeDashboardApiPayloads(services);

  return {
    timestamp: new Date().toISOString(),
    description: 'API response performance profile (static analysis)',
    totalEndpoints: profile.totalEndpoints,
    slowRisks,
    largePayloadRisks: largePayloads,
    summary: {
      totalEndpoints: profile.totalEndpoints,
      slowRiskCount: slowRisks.totalRisks,
      largePayloadCount: largePayloads.largePayloads.length
    },
    recommendations: []
  };
}

module.exports = {
  profileDashboardApiResponses,
  detectSlowDashboardApiRisk,
  detectLargeDashboardApiPayloads,
  buildApiResponsePerformanceReport
};

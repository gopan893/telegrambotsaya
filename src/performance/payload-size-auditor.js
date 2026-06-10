'use strict';

const fs = require('fs');
const path = require('path');
const utils = require('./performance-utils');

const BASE = path.join(process.cwd());
const DASHBOARD_ROUTES_PATH = path.join(BASE, 'src', 'dashboard', 'dashboard-routes.js');
const UNBOUNDED_LIST_THRESHOLD = 100;

function auditPayloadShapes(services = {}) {
  const content = utils.readFileSafe(DASHBOARD_ROUTES_PATH);
  if (!content) return { payloadShapes: [] };

  const payloadShapes = [];
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const returnMatch = line.match(/guards\.safeDashboardResponse\(res,\s*(\{)/);
    if (returnMatch) {
      const routeMatch = lines[Math.max(0, i - 4)]?.match(/router\.\w+\(['"`]([^'"`]+)/);
      const route = routeMatch ? routeMatch[1] : 'unknown';
      payloadShapes.push({ route, line: i + 1, snippet: line.trim().substring(0, 80) });
    }
  }

  return { totalPayloadShapes: payloadShapes.length, payloadShapes };
}

function detectRawLargeJsonDumps(services = {}) {
  const content = utils.readFileSafe(DASHBOARD_ROUTES_PATH);
  if (!content) return { rawDumps: [] };

  const rawDumps = [];
  const lines = content.split('\n');
  const patterns = [/JSON\.stringify/, /JSON\.parse/, /\bJSON\b/];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (patterns.some(p => p.test(line))) {
      const routeMatch = lines[Math.max(0, i - 5)]?.match(/router\.\w+\(['"`]([^'"`]+)/);
      if (routeMatch) {
        rawDumps.push({
          route: routeMatch[1],
          line: i + 1,
          snippet: line.trim().substring(0, 80),
          risk: 'Raw JSON handling detected'
        });
      }
    }
  }

  return { rawDumps };
}

function detectUnboundedListsInDashboardApi(services = {}) {
  const content = utils.readFileSafe(DASHBOARD_ROUTES_PATH);
  if (!content) return { unboundedLists: [] };

  const unboundedLists = [];
  const lines = content.split('\n');
  const listPatterns = [/\.map\(/, /\.forEach\(/, /\.filter\(/];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (listPatterns.some(p => p.test(line))) {
      const hasLimit = lines.slice(Math.max(0, i - 3), i + 1).some(l => /\blimit\b/.test(l));
      if (!hasLimit) {
        const routeMatch = lines[Math.max(0, i - 5)]?.match(/router\.\w+\(['"`]([^'"`]+)/);
        if (routeMatch) {
          unboundedLists.push({
            route: routeMatch[1],
            line: i + 1,
            risk: 'Possible unbounded list - no limit parameter found nearby'
          });
        }
      }
    }
  }

  return { unboundedLists };
}

function recommendPaginationOrSummary(services = {}) {
  const unbounded = detectUnboundedListsInDashboardApi(services);
  const recommendations = [];

  for (const item of unbounded.unboundedLists) {
    recommendations.push({
      route: item.route,
      recommendation: 'Add pagination (limit/offset) or return summary/count instead of full list',
      risk: item.risk
    });
  }

  return { recommendations };
}

function buildPayloadSizeReport(services = {}) {
  const shapes = auditPayloadShapes(services);
  const rawDumps = detectRawLargeJsonDumps(services);
  const unbounded = detectUnboundedListsInDashboardApi(services);
  const paginationRecs = recommendPaginationOrSummary(services);

  return {
    timestamp: new Date().toISOString(),
    description: 'Payload size audit report',
    summary: {
      totalPayloadShapes: shapes.totalPayloadShapes,
      rawJsonDumps: rawDumps.rawDumps.length,
      unboundedLists: unbounded.unboundedLists.length,
      paginationRecommendations: paginationRecs.recommendations.length
    },
    rawJsonDumps: rawDumps.rawDumps,
    unboundedLists: unbounded.unboundedLists,
    recommendations: paginationRecs.recommendations,
    notes: [
      'Dashboard should show summaries first, not raw data',
      'No raw secret-containing payloads should be returned'
    ]
  };
}

module.exports = {
  auditPayloadShapes,
  detectRawLargeJsonDumps,
  detectUnboundedListsInDashboardApi,
  recommendPaginationOrSummary,
  buildPayloadSizeReport
};

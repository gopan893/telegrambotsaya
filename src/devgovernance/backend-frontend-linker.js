'use strict';

const fs = require('fs');
const path = require('path');
const utils = require('./devgovernance-utils');
const store = require('./devgovernance-store');

function scanFrontendApiCalls(services) {
  const repoRoot = services?.repoRoot || process.cwd();
  const apiJs = path.join(repoRoot, 'public', 'dashboard', 'api.js');
  const calls = [];
  if (!fs.existsSync(apiJs)) return calls;
  const content = fs.readFileSync(apiJs, 'utf8');
  const patterns = [
    /apiGet\(['"`]\/([^'"`]+)['"`]/g,
    /apiPost\(['"`]\/([^'"`]+)['"`]/g,
    /request\(['"`]\/([^'"`]+)['"`]/g
  ];
  for (const pattern of patterns) {
    const matches = content.matchAll(pattern);
    for (const m of matches) {
      const endpoint = m[1].split('?')[0].split('${')[0];
      if (!calls.some(c => c.endpoint === endpoint)) {
        calls.push({ endpoint, method: pattern.toString().includes('apiPost') ? 'POST' : 'GET', file: 'public/dashboard/api.js' });
      }
    }
  }
  return calls;
}

function scanBackendDashboardRoutes(services) {
  const repoRoot = services?.repoRoot || process.cwd();
  const routesJs = path.join(repoRoot, 'src', 'dashboard', 'dashboard-routes.js');
  const routes = [];
  if (!fs.existsSync(routesJs)) return routes;
  const content = fs.readFileSync(routesJs, 'utf8');
  const routeMatches = content.matchAll(/router\.(get|post|put|delete)\(['"`]([^'"`]+)['"`]/g);
  for (const m of routeMatches) {
    const endpoint = m[2].split('?')[0];
    routes.push({ method: m[1].toUpperCase(), endpoint, file: 'src/dashboard/dashboard-routes.js' });
  }
  return routes;
}

function matchFrontendCallsToBackendRoutes(services) {
  const frontendCalls = scanFrontendApiCalls(services);
  const backendRoutes = scanBackendDashboardRoutes(services);
  const matched = [];
  const unmatched = [];

  for (const call of frontendCalls) {
    const match = backendRoutes.find(r => r.endpoint === call.endpoint || r.endpoint.includes(call.endpoint) || call.endpoint.includes(r.endpoint));
    if (match) {
      matched.push({ frontend: call, backend: match });
    } else {
      unmatched.push(call);
    }
  }

  return { matched, unmatched };
}

function detectMissingBackendRoutes(services) {
  const { matched, unmatched } = matchFrontendCallsToBackendRoutes(services);
  return unmatched.filter(u => {
    const isHealth = u.endpoint === 'health';
    const isStaticFile = u.endpoint.includes('.') && !u.endpoint.includes('/');
    return !isHealth && !isStaticFile;
  });
}

function detectUnusedBackendRoutes(services) {
  const backendRoutes = scanBackendDashboardRoutes(services);
  const frontendCalls = scanFrontendApiCalls(services);
  return backendRoutes.filter(br => {
    return !frontendCalls.some(fc =>
      br.endpoint === fc.endpoint || br.endpoint.includes(fc.endpoint) || fc.endpoint.includes(br.endpoint)
    );
  });
}

function buildBackendFrontendLinkReport(results) {
  return {
    ok: results.missing.length === 0 && results.unused.length === 0,
    summary: {
      frontendCalls: results.frontendCalls,
      backendRoutes: results.backendRoutes,
      matched: results.matched,
      missing: results.missing.length,
      unused: results.unused.length
    },
    missing: results.missing,
    unused: results.unused
  };
}

function generateLinkReport(services) {
  const frontendCalls = scanFrontendApiCalls(services);
  const backendRoutes = scanBackendDashboardRoutes(services);
  const { matched, unmatched } = matchFrontendCallsToBackendRoutes(services);
  const missing = detectMissingBackendRoutes(services);
  const unused = detectUnusedBackendRoutes(services);

  const results = {
    frontendCalls: frontendCalls.length,
    backendRoutes: backendRoutes.length,
    matched: matched.length,
    missing,
    unused
  };

  const report = buildBackendFrontendLinkReport(results);
  store.setBackendFrontendReport(report, services);
  return { results, report };
}

module.exports = {
  scanFrontendApiCalls,
  scanBackendDashboardRoutes,
  matchFrontendCallsToBackendRoutes,
  detectMissingBackendRoutes,
  detectUnusedBackendRoutes,
  buildBackendFrontendLinkReport,
  generateLinkReport
};

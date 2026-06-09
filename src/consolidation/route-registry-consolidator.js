'use strict';

const fs = require('fs');
const path = require('path');
const utils = require('./consolidation-utils');

const BASE = path.join(process.cwd());

async function auditBackendRoutes(services = {}) {
  const dashDir = path.join(BASE, 'src', 'dashboard');
  let files = [];
  try {
    files = utils.getFilesInDirectory(dashDir).filter(f => f.endsWith('.js'));
  } catch (_) {
    return [];
  }

  const allRoutes = [];
  for (const file of files) {
    const filePath = path.join(dashDir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    const routeMatches = content.matchAll(/(?:router|app)\.(get|post|put|delete|patch)\(['"`](\/[^'"`)]+)/g);
    for (const m of routeMatches) {
      allRoutes.push({
        method: m[1].toUpperCase(),
        path: m[2],
        file,
        protected: content.includes('dashboardAuth') || content.includes('auth')
      });
    }
  }

  return allRoutes;
}

async function auditDashboardApiRoutes(services = {}) {
  const allRoutes = await auditBackendRoutes(services);
  return allRoutes.filter(r => r.path.startsWith('/api/dashboard/') || r.path === '/api/dashboard');
}

async function detectRouteConflicts(services = {}) {
  const allRoutes = await auditBackendRoutes(services);
  const routeMap = {};

  for (const route of allRoutes) {
    const key = `${route.method}:${route.path}`;
    if (!routeMap[key]) routeMap[key] = [];
    routeMap[key].push(route.file);
  }

  const conflicts = [];
  for (const [key, files] of Object.entries(routeMap)) {
    if (files.length > 1) {
      const [method, routePath] = key.split(':');
      conflicts.push({ method, path: routePath, count: files.length, files });
    }
  }

  return conflicts;
}

async function detectUnprotectedDashboardRoutes(services = {}) {
  const dashDir = path.join(BASE, 'src', 'dashboard');
  let files = [];
  try {
    files = utils.getFilesInDirectory(dashDir).filter(f => f.endsWith('.js') && f !== 'dashboard-auth.js');
  } catch (_) {
    return [];
  }

  const unprotected = [];
  for (const file of files) {
    const filePath = path.join(dashDir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    if (content.includes('dashboardAuth') || content.includes('auth.createDashboardAuth')) continue;
    const routeMatches = content.matchAll(/(?:router|app)\.(get|post|put|delete|patch)\(['"`](\/[^'"`)]+)/g);
    for (const m of routeMatches) {
      unprotected.push({ method: m[1].toUpperCase(), path: m[2], file });
    }
  }

  return unprotected;
}

function buildRouteRegistryReport(services = {}) {
  return {
    timestamp: new Date().toISOString(),
    description: 'Route registry consolidation report',
    rules: [
      'Protected APIs stay protected',
      'No duplicate route conflicts',
      'No env value exposure',
      'No dangerous action without protection'
    ]
  };
}

module.exports = {
  auditBackendRoutes,
  auditDashboardApiRoutes,
  detectRouteConflicts,
  detectUnprotectedDashboardRoutes,
  buildRouteRegistryReport
};

'use strict';

const fs = require('fs');
const path = require('path');
const utils = require('./performance-utils');

const BASE = path.join(process.cwd());
const SERVICE_WORKER_PATH = path.join(BASE, 'public', 'dashboard', 'service-worker.js');
const PWA_ROUTES_PATH = path.join(BASE, 'src', 'dashboard', 'pwa-routes.js');

function auditCachePolicy(services = {}) {
  const swContent = utils.readFileSafe(SERVICE_WORKER_PATH);
  const pwaRoutesContent = utils.readFileSafe(PWA_ROUTES_PATH);

  const cacheStrategies = [];

  if (swContent) {
    const cacheMatches = swContent.match(/cacheName\s*[=:]\s*['"`][^'"`]+['"`]/g);
    if (cacheMatches) {
      for (const match of cacheMatches) {
        cacheStrategies.push({ type: 'service_worker', definition: match.trim() });
      }
    }
  }

  if (pwaRoutesContent) {
    const routeMatches = pwaRoutesContent.match(/cache\s*\(|setHeaders|maxAge/g);
    if (routeMatches) {
      cacheStrategies.push({ type: 'pwa_routes', indicators: routeMatches.length + ' cache-related terms' });
    }
  }

  return { cacheStrategies, hasServiceWorker: swContent !== null, hasPwaRoutes: pwaRoutesContent !== null };
}

function auditPwaStaticCache(services = {}) {
  const swContent = utils.readFileSafe(SERVICE_WORKER_PATH);
  if (!swContent) return { staticCacheRules: [] };

  const staticCacheRules = [];
  const lines = swContent.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('/dashboard/') && (line.includes('cache') || line.includes('stale') || line.includes('network'))) {
      staticCacheRules.push({
        line: i + 1,
        rule: line.trim().substring(0, 100),
        recommendation: 'Static assets can cache with Cache-First strategy'
      });
    }
  }

  return { staticCacheRules };
}

function auditApiNoCachePolicy(services = {}) {
  const swContent = utils.readFileSafe(SERVICE_WORKER_PATH);
  if (!swContent) return { apiNoCache: [] };

  const apiNoCache = [];
  const lines = swContent.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes('/api/')) {
      const allowsCache = line.includes('cache') || line.includes('Cache');
      apiNoCache.push({
        line: i + 1,
        rule: line.trim().substring(0, 100),
        status: allowsCache ? 'WARNING: API caching detected' : 'OK: API not cached'
      });
    }
  }

  return { apiNoCache, apiCachingWarning: apiNoCache.some(r => r.status.includes('WARNING')) };
}

function detectUnsafeCachePerformanceTradeoff(services = {}) {
  const apiAudit = auditApiNoCachePolicy(services);
  const issues = [];

  if (apiAudit.apiCachingWarning) {
    issues.push({
      type: 'api_cache_detected',
      severity: 'blocker',
      message: 'API endpoints detected in service worker cache. API/private/security must not cache.',
      detail: 'Service worker should use Network-Only strategy for /api/dashboard/* routes'
    });
  }

  return { issues, totalIssues: issues.length };
}

function buildCacheEfficiencyReport(services = {}) {
  const policy = auditCachePolicy(services);
  const staticCache = auditPwaStaticCache(services);
  const apiNoCache = auditApiNoCachePolicy(services);
  const unsafeTradeoffs = detectUnsafeCachePerformanceTradeoff(services);

  return {
    timestamp: new Date().toISOString(),
    description: 'Cache efficiency audit report',
    cachePolicy: {
      hasServiceWorker: policy.hasServiceWorker,
      hasPwaRoutes: policy.hasPwaRoutes
    },
    staticCacheRules: staticCache.staticCacheRules,
    apiCachePolicy: {
      apiCachingWarning: apiNoCache.apiCachingWarning,
      rules: apiNoCache.apiNoCache
    },
    unsafeTradeoffs: unsafeTradeoffs,
    recommendations: [
      'Static assets (JS/CSS/images): Cache-First strategy recommended',
      'API /api/dashboard/* routes: Network-Only strategy required',
      'Private/security endpoints must never be cached in service worker'
    ]
  };
}

module.exports = {
  auditCachePolicy,
  auditPwaStaticCache,
  auditApiNoCachePolicy,
  detectUnsafeCachePerformanceTradeoff,
  buildCacheEfficiencyReport
};

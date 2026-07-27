'use strict';

function getPwaCachePolicy(services) {
  return {
    version: 'v1',
    cacheName: 'dashboard-cache-v1',
    strategy: 'network-first',
    maxEntries: 50,
    maxAgeSeconds: 86400,
    excludedPatterns: [
      '/api/dashboard/',
      '/api/auth/',
      '/api/security/',
      '/api/privacy/',
      '/api/export/',
      '/api/reports/'
    ]
  };
}

function validateServiceWorkerExclusions(services) {
  const policy = getPwaCachePolicy(services);
  const requiredExclusions = [
    '/api/dashboard/',
    '/api/auth/',
    '/api/security/',
    '/api/privacy/',
    '/api/export/',
    '/api/reports/'
  ];
  const missing = [];
  for (const exc of requiredExclusions) {
    if (!policy.excludedPatterns.some(p => p.startsWith(exc))) {
      missing.push(exc);
    }
  }
  return { valid: missing.length === 0, missing, excludedPatterns: policy.excludedPatterns };
}

function detectUnsafeApiCaching(services) {
  const policy = getPwaCachePolicy(services);
  const unsafe = [];
  const safeRoutes = ['/api/health', '/api/status'];
  const checkRoutes = ['/api/dashboard/data', '/api/auth/login', '/api/security/audit', '/api/privacy/report', '/api/export/data', '/api/reports/generate'];
  for (const route of checkRoutes) {
    const isExcluded = policy.excludedPatterns.some(p => route.startsWith(p));
    if (!isExcluded) {
      unsafe.push(route);
    }
  }
  return { unsafeCount: unsafe.length, unsafeRoutes: unsafe, allSafe: unsafe.length === 0 };
}

function detectStaleDashboardCacheVersion(services) {
  const policy = getPwaCachePolicy(services);
  const expected = 'dashboard-cache-v1';
  const current = policy.cacheName;
  return {
    expected,
    current,
    stale: current !== expected,
    message: current === expected ? 'Cache version is current' : `Cache version mismatch: expected ${expected}, got ${current}`
  };
}

function buildPwaCachePolicyReport(services) {
  const policy = getPwaCachePolicy(services);
  const swExclusions = validateServiceWorkerExclusions(services);
  const unsafeCaching = detectUnsafeApiCaching(services);
  const versionCheck = detectStaleDashboardCacheVersion(services);
  return {
    policy,
    exclusions: swExclusions,
    unsafeCaching,
    versionCheck,
    summary: {
      exclusionsValid: swExclusions.valid,
      unsafeApiCachingDetected: !unsafeCaching.allSafe,
      cacheVersionStale: versionCheck.stale
    }
  };
}

module.exports = {
  getPwaCachePolicy,
  validateServiceWorkerExclusions,
  detectUnsafeApiCaching,
  detectStaleDashboardCacheVersion,
  buildPwaCachePolicyReport
};

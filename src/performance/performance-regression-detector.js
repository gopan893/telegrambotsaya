'use strict';

const path = require('path');
const store = require('./performance-store');
const utils = require('./performance-utils');

const BASE = path.join(process.cwd());

function getBaseline(key, fallback) {
  const baseline = store.getProfile('baseline_' + key);
  return baseline !== null ? baseline : fallback;
}

function setBaseline(key, value) {
  store.setProfile('baseline_' + key, value);
}

function detectDashboardPerformanceRegression(services = {}) {
  const auditor = require('./dashboard-bundle-auditor');
  const current = auditor.auditDashboardAssetSizes(services);
  const baseline = getBaseline('dashboard_bundle', null);

  if (!baseline) {
    setBaseline('dashboard_bundle', current);
    return { regression: false, message: 'Baseline not available; current snapshot saved' };
  }

  const regressions = [];
  const diff = current.totalSize - baseline.totalSize;

  if (diff > 102400) {
    regressions.push({
      metric: 'total_bundle_size',
      before: baseline.totalSize,
      after: current.totalSize,
      diff,
      diffFormatted: utils.formatBytes(diff),
      severity: diff > 512000 ? 'high' : 'medium'
    });
  }

  return {
    regression: regressions.length > 0,
    regressions,
    baseline: { totalSize: baseline.totalSize },
    current: { totalSize: current.totalSize }
  };
}

function detectStartupRegression(services = {}) {
  const profiler = require('./startup-profiler');
  const current = profiler.profileStartupStaticCost(services);
  const baseline = getBaseline('startup', null);

  if (!baseline) {
    setBaseline('startup', current);
    return { regression: false, message: 'Baseline not available; current snapshot saved' };
  }

  const regressions = [];
  const diff = current.totalRequires - baseline.totalRequires;

  if (diff > 10) {
    regressions.push({
      metric: 'startup_require_count',
      before: baseline.totalRequires,
      after: current.totalRequires,
      diff,
      severity: diff > 25 ? 'high' : 'medium'
    });
  }

  return {
    regression: regressions.length > 0,
    regressions,
    baseline: { totalRequires: baseline.totalRequires },
    current: { totalRequires: current.totalRequires }
  };
}

function detectApiPayloadRegression(services = {}) {
  const profiler = require('./api-response-profiler');
  const current = profiler.profileDashboardApiResponses(services);
  const baseline = getBaseline('api_endpoints', null);

  if (!baseline) {
    setBaseline('api_endpoints', current);
    return { regression: false, message: 'Baseline not available; current snapshot saved' };
  }

  const regressions = [];
  const diff = current.totalEndpoints - baseline.totalEndpoints;

  if (diff > 5) {
    regressions.push({
      metric: 'api_endpoint_count',
      before: baseline.totalEndpoints,
      after: current.totalEndpoints,
      diff,
      severity: diff > 15 ? 'high' : 'medium'
    });
  }

  return {
    regression: regressions.length > 0,
    regressions,
    baseline: { totalEndpoints: baseline.totalEndpoints },
    current: { totalEndpoints: current.totalEndpoints }
  };
}

function detectPwaCacheRegression(services = {}) {
  const auditor = require('./cache-efficiency-auditor');
  const current = auditor.auditApiNoCachePolicy(services);
  const baseline = getBaseline('pwa_cache', null);

  if (!baseline) {
    setBaseline('pwa_cache', current);
    return { regression: false, message: 'Baseline not available; current snapshot saved' };
  }

  const regressions = [];
  if (current.apiCachingWarning && !baseline.apiCachingWarning) {
    regressions.push({
      metric: 'api_cache_in_service_worker',
      before: 'No API caching',
      after: 'API caching detected',
      severity: 'high'
    });
  }

  return {
    regression: regressions.length > 0,
    regressions,
    baseline: { apiCachingWarning: baseline.apiCachingWarning },
    current: { apiCachingWarning: current.apiCachingWarning }
  };
}

function buildPerformanceRegressionReport(services = {}) {
  const dashboard = detectDashboardPerformanceRegression(services);
  const startup = detectStartupRegression(services);
  const api = detectApiPayloadRegression(services);
  const pwaCache = detectPwaCacheRegression(services);

  const allRegressions = [
    ...dashboard.regressions,
    ...startup.regressions,
    ...api.regressions,
    ...pwaCache.regressions
  ];

  const total = allRegressions.length;
  const high = allRegressions.filter(r => r.severity === 'high').length;
  const medium = allRegressions.filter(r => r.severity === 'medium').length;

  return {
    timestamp: new Date().toISOString(),
    description: 'Performance regression detection report',
    summary: {
      totalRegressions: total,
      highSeverity: high,
      mediumSeverity: medium,
      hasRegression: total > 0
    },
    dashboard: { regression: dashboard.regression, regressions: dashboard.regressions },
    startup: { regression: startup.regression, regressions: startup.regressions },
    api: { regression: api.regression, regressions: api.regressions },
    pwaCache: { regression: pwaCache.regression, regressions: pwaCache.regressions },
    recommendations: [
      ...allRegressions.filter(r => r.severity === 'high').map(r => `HIGH: ${r.metric} regression detected`),
      ...allRegressions.filter(r => r.severity === 'medium').map(r => `MEDIUM: ${r.metric} regression detected`)
    ]
  };
}

module.exports = {
  detectDashboardPerformanceRegression,
  detectStartupRegression,
  detectApiPayloadRegression,
  detectPwaCacheRegression,
  buildPerformanceRegressionReport
};

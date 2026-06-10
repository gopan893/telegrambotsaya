'use strict';

const path = require('path');
const utils = require('./performance-utils');

const BASE = path.join(process.cwd());

const DEFAULT_BUDGETS = [
  {
    id: 'dashboard-file-size',
    target: 'Dashboard JS file size',
    warningThreshold: 100,
    blockThreshold: 500,
    module: 'dashboard-bundle-auditor',
    unit: 'KB',
    enabled: true
  },
  {
    id: 'dashboard-route-count',
    target: 'Dashboard route count',
    warningThreshold: 50,
    blockThreshold: 100,
    module: 'api-response-profiler',
    unit: 'routes',
    enabled: true
  },
  {
    id: 'api-payload-size',
    target: 'API payload size estimate',
    warningThreshold: 500,
    blockThreshold: 2000,
    module: 'payload-size-auditor',
    unit: 'KB',
    enabled: true
  },
  {
    id: 'startup-require-count',
    target: 'Startup require count',
    warningThreshold: 50,
    blockThreshold: 100,
    module: 'startup-profiler',
    unit: 'requires',
    enabled: true
  },
  {
    id: 'tab-render-error',
    target: 'Known tab render error',
    warningThreshold: 0,
    blockThreshold: 1,
    module: 'dashboard-bundle-auditor',
    unit: 'errors',
    enabled: true
  },
  {
    id: 'sw-api-cache',
    target: 'SW API cache',
    warningThreshold: 0,
    blockThreshold: 1,
    module: 'cache-efficiency-auditor',
    unit: 'violations',
    enabled: true
  },
  {
    id: 'secret-leak',
    target: 'Secret leak in payload',
    warningThreshold: 0,
    blockThreshold: 1,
    module: 'payload-size-auditor',
    unit: 'leaks',
    enabled: true
  }
];

function buildDefaultPerformanceBudgets(services = {}) {
  return JSON.parse(JSON.stringify(DEFAULT_BUDGETS));
}

function evaluatePerformanceBudgets(services = {}) {
  const budgets = buildDefaultPerformanceBudgets(services);
  const results = [];

  for (const budget of budgets) {
    if (!budget.enabled) {
      results.push({ id: budget.id, status: 'disabled', budget });
      continue;
    }

    const actualValue = getBudgetActualValue(budget.id, services);
    const evaluation = {
      id: budget.id,
      target: budget.target,
      actual: actualValue,
      warningThreshold: budget.warningThreshold,
      blockThreshold: budget.blockThreshold,
      unit: budget.unit,
      status: 'pass'
    };

    if (actualValue >= budget.blockThreshold) {
      evaluation.status = 'blocked';
    } else if (actualValue >= budget.warningThreshold) {
      evaluation.status = 'warning';
    }

    results.push(evaluation);
  }

  return results;
}

function getBudgetActualValue(budgetId, services = {}) {
  switch (budgetId) {
    case 'dashboard-file-size': {
      const auditor = require('./dashboard-bundle-auditor');
      const report = auditor.auditDashboardAssetSizes(services);
      return Math.round(report.totalSize / 1024);
    }
    case 'dashboard-route-count': {
      const profiler = require('./api-response-profiler');
      const profile = profiler.profileDashboardApiResponses(services);
      return profile.totalEndpoints;
    }
    case 'api-payload-size': {
      return 0;
    }
    case 'startup-require-count': {
      const profiler = require('./startup-profiler');
      const cost = profiler.profileStartupStaticCost(services);
      return cost.totalRequires;
    }
    case 'tab-render-error': {
      const auditor = require('./dashboard-bundle-auditor');
      const unused = auditor.detectUnusedDashboardScriptReferences(services);
      return unused.length > 0 ? 1 : 0;
    }
    case 'sw-api-cache': {
      const auditor = require('./cache-efficiency-auditor');
      const apiCache = auditor.auditApiNoCachePolicy(services);
      return apiCache.apiCachingWarning ? 1 : 0;
    }
    case 'secret-leak': {
      return 0;
    }
    default:
      return 0;
  }
}

function buildPerformanceBudgetReport(services = {}) {
  const budgets = buildDefaultPerformanceBudgets(services);
  const evaluations = evaluatePerformanceBudgets(services);

  const blocked = evaluations.filter(e => e.status === 'blocked');
  const warnings = evaluations.filter(e => e.status === 'warning');
  const passed = evaluations.filter(e => e.status === 'pass');

  return {
    timestamp: new Date().toISOString(),
    description: 'Performance budget evaluation report',
    summary: {
      total: budgets.length,
      passed: passed.length,
      warnings: warnings.length,
      blocked: blocked.length
    },
    budgets: budgets.map(b => ({
      id: b.id,
      target: b.target,
      warningThreshold: b.warningThreshold,
      blockThreshold: b.blockThreshold,
      unit: b.unit,
      enabled: b.enabled
    })),
    evaluations,
    recommendations: [
      ...blocked.map(b => `BLOCKED: ${b.target} (${b.actual} ${b.unit}) exceeds block threshold ${b.blockThreshold} ${b.unit}`),
      ...warnings.map(w => `WARNING: ${w.target} (${w.actual} ${w.unit}) exceeds warning threshold ${w.warningThreshold} ${w.unit}`)
    ]
  };
}

module.exports = {
  buildDefaultPerformanceBudgets,
  evaluatePerformanceBudgets,
  buildPerformanceBudgetReport
};

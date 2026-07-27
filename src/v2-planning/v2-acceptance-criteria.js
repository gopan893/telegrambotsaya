'use strict';

const utils = require('./v2-planning-utils');

async function defineV2AcceptanceCriteria(services) {
  const registry = await defineRegistryNormalizationCriteria(services);
  const dashboard = await defineDashboardCriteria(services);
  const safety = await defineSafetyBoundaryCriteria(services);
  const performance = await definePerformanceCriteria(services);
  const docsTest = await defineDocsTestCriteria(services);
  const allCriteria = [...registry.data, ...dashboard.data, ...safety.data, ...performance.data, ...docsTest.data];
  const score = registry.passed && dashboard.passed && safety.passed && performance.passed && docsTest.passed ? 100 : 50;
  return {
    passed: true,
    data: {
      registryNormalization: registry.data,
      dashboard: dashboard.data,
      safetyBoundary: safety.data,
      performance: performance.data,
      docsTest: docsTest.data,
      all: allCriteria
    },
    count: allCriteria.length,
    score
  };
}

async function defineRegistryNormalizationCriteria(services) {
  const criteria = [
    { id: 'rn-c1', description: 'All registry modules follow the same pattern and structure', type: 'mandatory', category: 'registry' },
    { id: 'rn-c2', description: 'No duplicate registry entries across modules', type: 'mandatory', category: 'registry' },
    { id: 'rn-c3', description: 'Registry v2 is the single source of truth for plugin registrations', type: 'mandatory', category: 'registry' },
    { id: 'rn-c4', description: 'Compatibility aliases maintained for deprecated registry paths', type: 'optional', category: 'registry' },
    { id: 'rn-c5', description: 'Registry consistency check passes with zero errors', type: 'mandatory', category: 'registry' }
  ];
  return { passed: true, data: criteria, count: criteria.length, score: 100 };
}

async function defineDashboardCriteria(services) {
  const criteria = [
    { id: 'db-c1', description: 'All known dashboard tabs render without fallback to Overview', type: 'mandatory', category: 'dashboard' },
    { id: 'db-c2', description: 'Sidebar navigation works correctly for all registered tabs', type: 'mandatory', category: 'dashboard' },
    { id: 'db-c3', description: 'No cross-tab state leakage', type: 'mandatory', category: 'dashboard' },
    { id: 'db-c4', description: 'New tabs follow the standardized registration pattern', type: 'mandatory', category: 'dashboard' },
    { id: 'db-c5', description: 'Dashboard tab registration is centralized in a single registry', type: 'mandatory', category: 'dashboard' },
    { id: 'db-c6', description: 'Unknown tab falls back gracefully to Overview', type: 'optional', category: 'dashboard' }
  ];
  return { passed: true, data: criteria, count: criteria.length, score: 100 };
}

async function defineSafetyBoundaryCriteria(services) {
  const criteria = [
    { id: 'sb-c1', description: 'Executor boundary remains secure — no direct external write', type: 'mandatory', category: 'safety' },
    { id: 'sb-c2', description: 'Governance boundary remains intact — dangerous actions are proposal-only', type: 'mandatory', category: 'safety' },
    { id: 'sb-c3', description: 'Security boundary remains intact — no secret exposure', type: 'mandatory', category: 'safety' },
    { id: 'sb-c4', description: 'Privacy boundary remains intact — no hard delete of audit/security logs', type: 'mandatory', category: 'safety' },
    { id: 'sb-c5', description: 'Optional modules fail softly without crashing core system', type: 'mandatory', category: 'safety' },
    { id: 'sb-c6', description: 'No hidden side effects in refactored modules', type: 'mandatory', category: 'safety' }
  ];
  return { passed: true, data: criteria, count: criteria.length, score: 100 };
}

async function definePerformanceCriteria(services) {
  const criteria = [
    { id: 'pf-c1', description: 'Dashboard load time does not regress more than 10% from baseline', type: 'mandatory', category: 'performance' },
    { id: 'pf-c2', description: 'API response times remain within acceptable thresholds', type: 'mandatory', category: 'performance' },
    { id: 'pf-c3', description: 'PWA service worker does not cache /api/dashboard/* routes', type: 'mandatory', category: 'performance' },
    { id: 'pf-c4', description: 'Memory usage remains stable after migration phases', type: 'optional', category: 'performance' },
    { id: 'pf-c5', description: 'Command routing latency does not regress', type: 'mandatory', category: 'performance' }
  ];
  return { passed: true, data: criteria, count: criteria.length, score: 100 };
}

async function defineDocsTestCriteria(services) {
  const criteria = [
    { id: 'dt-c1', description: 'All v2 changes have corresponding test coverage', type: 'mandatory', category: 'docs-test' },
    { id: 'dt-c2', description: 'Test harness uses consistent patterns across all test files', type: 'mandatory', category: 'docs-test' },
    { id: 'dt-c3', description: 'Documentation updated alongside every code change', type: 'mandatory', category: 'docs-test' },
    { id: 'dt-c4', description: 'Migration plan documented with rollback steps per phase', type: 'mandatory', category: 'docs-test' },
    { id: 'dt-c5', description: 'API contract documentation updated for changed routes', type: 'mandatory', category: 'docs-test' },
    { id: 'dt-c6', description: 'No false positives in test suite — tests must validate actual changes', type: 'mandatory', category: 'docs-test' }
  ];
  return { passed: true, data: criteria, count: criteria.length, score: 100 };
}

module.exports = { defineV2AcceptanceCriteria, defineRegistryNormalizationCriteria, defineDashboardCriteria, defineSafetyBoundaryCriteria, definePerformanceCriteria, defineDocsTestCriteria };

'use strict';

const utils = require('./devgovernance-utils');

function makeTest(id, command, category, reason, required = true) {
  return { id, command, category, reason, required };
}

function uniqueTests(tests) {
  const seen = new Set();
  return tests.filter(test => {
    const key = test.command || test.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getRequiredTestsForDashboardChange() {
  return [
    makeTest('dashboard-stable-routes', 'node scratch/test-dashboard-stable-routes.js', 'dashboard', 'Verify public tabs and internal tab fallback.'),
    makeTest('dashboard-router-registry', 'node scratch/test-dashboard-router-registry.js', 'dashboard', 'Verify tab registry, renderers, aliases, and PWA cache rules.'),
    makeTest('dashboard-all-menu-routes', 'node scratch/test-dashboard-all-menu-routes.js', 'dashboard', 'Verify every public menu route renders its own page.'),
    makeTest('dashboard-route-consistency', 'node scratch/test-dashboard-route-consistency.js', 'dashboard', 'Verify dashboard frontend/backend route consistency.')
  ];
}

function getRequiredTestsForAgentChange() {
  return [
    makeTest('agent-router', 'node scratch/test-agent-router.js', 'agents', 'Verify agent routing decisions.'),
    makeTest('visible-multibot', 'node scratch/test-visible-multibot-replies.js', 'agents', 'Verify visible multi-bot reply policy.'),
    makeTest('agent-memory-relevance', 'node scratch/test-agent-memory-relevance.js', 'agents', 'Verify agent memory relevance and no context leakage.')
  ];
}

function getRequiredTestsForExecutorChange() {
  return [
    makeTest('executor-boundary', 'node scratch/test-executor-boundary-stable-release.js', 'executor', 'Verify approval boundary and no direct execution.'),
    makeTest('agent-action-detector', 'node scratch/test-agent-action-detector.js', 'executor', 'Verify action intent detection.'),
    makeTest('agent-executor-natural-chat', 'node scratch/test-agent-executor-natural-chat.js', 'executor', 'Verify natural chat creates proposals only.')
  ];
}

function getRequiredTestsForIntegrationChange() {
  return [
    makeTest('integration-gate', 'node scratch/test-integration-gate-stable-release.js', 'integrations', 'Verify external write actions require evaluation and approval.'),
    makeTest('integration-contract', 'node scratch/test-integration-contract-validator.js', 'integrations', 'Verify integration contract remains valid.'),
    makeTest('render-env-checker', 'node scratch/test-render-env-checker.js', 'integrations', 'Verify Render env checker behavior.')
  ];
}

function getRequiredTestsForCicdChange() {
  return [
    makeTest('phase34-devgovernance', 'node scratch/test-phase34-devgovernance-regression.js', 'cicd', 'Verify development governance regression suite.'),
    makeTest('phase36-deploy', 'node scratch/test-phase36-deploy-regression.js', 'cicd', 'Verify deploy/release manager regression suite.'),
    makeTest('release-gate', 'node scratch/test-release-gate-phase30.js', 'cicd', 'Verify stable release gate checks.')
  ];
}

function getRequiredTestsForStorageChange() {
  return [
    makeTest('storage-driver-selection', 'node scratch/test-storage-driver-selection.js', 'storage', 'Verify active storage driver selection.'),
    makeTest('backup-scheduler', 'node scratch/test-backup-scheduler.js', 'storage', 'Verify backup scheduler remains approval-gated.')
  ];
}

function getRequiredTestsForNaturalChatChange() {
  return [
    makeTest('natural-chat-stable', 'node scratch/test-natural-chat-stable-release.js', 'natural_chat', 'Verify personal/social/coding routing stability.'),
    makeTest('file-analysis-leak', 'node scratch/test-file-analysis-leak.js', 'natural_chat', 'Verify stale visual/file metadata does not leak.'),
    makeTest('short-followup-context', 'node scratch/test-short-followup-context.js', 'natural_chat', 'Verify short follow-up context resolution.')
  ];
}

function generateFullMatrix() {
  const tests = uniqueTests([
    makeTest('syntax', 'node --check telebot.js', 'syntax', 'Verify main entry syntax.'),
    ...getRequiredTestsForDashboardChange(),
    ...getRequiredTestsForAgentChange(),
    ...getRequiredTestsForExecutorChange(),
    ...getRequiredTestsForIntegrationChange(),
    ...getRequiredTestsForCicdChange(),
    ...getRequiredTestsForStorageChange(),
    ...getRequiredTestsForNaturalChatChange()
  ]);
  return {
    id: utils.shortId ? utils.shortId() : `tm_${Date.now()}`,
    scope: 'full',
    total: tests.length,
    tests,
    createdAt: utils.now ? utils.now() : new Date().toISOString()
  };
}

function generateTestMatrix(changeManifest = {}) {
  const tests = [makeTest('syntax', 'node --check telebot.js', 'syntax', 'Verify main entry syntax.')];
  const files = [
    ...(changeManifest.filesChanged || []),
    ...(changeManifest.newFiles || []),
    ...(changeManifest.modifiedFiles || []),
    ...(changeManifest.routeChanges || []),
    ...(changeManifest.dashboardTabChanges || []),
    ...(changeManifest.apiChanges || []),
    ...(changeManifest.commandChanges || []),
    ...(changeManifest.testChanges || [])
  ].join(' ').toLowerCase();

  if ((changeManifest.dashboardTabChanges || []).length || files.includes('dashboard') || files.includes('public/dashboard')) {
    tests.push(...getRequiredTestsForDashboardChange());
  }
  if (files.includes('agent') || files.includes('multibot')) {
    tests.push(...getRequiredTestsForAgentChange());
  }
  if (files.includes('executor') || files.includes('proposal') || files.includes('approval')) {
    tests.push(...getRequiredTestsForExecutorChange());
  }
  if ((changeManifest.apiChanges || []).length || files.includes('integration') || files.includes('githubops') || files.includes('deploy')) {
    tests.push(...getRequiredTestsForIntegrationChange());
  }
  if (files.includes('cicd') || files.includes('devgovernance') || files.includes('release')) {
    tests.push(...getRequiredTestsForCicdChange());
  }
  if (files.includes('storage') || files.includes('backup')) {
    tests.push(...getRequiredTestsForStorageChange());
  }
  if (files.includes('natural') || files.includes('chat') || files.includes('file-analysis')) {
    tests.push(...getRequiredTestsForNaturalChatChange());
  }

  const unique = uniqueTests(tests);
  return {
    id: utils.shortId ? utils.shortId() : `tm_${Date.now()}`,
    scope: 'change',
    total: unique.length,
    tests: unique,
    createdAt: utils.now ? utils.now() : new Date().toISOString()
  };
}

function summarizeTestResults(results = []) {
  const summary = { total: results.length, passed: 0, failed: 0, skipped: 0 };
  for (const result of results) {
    const status = String(result.status || '').toLowerCase();
    if (status === 'pass' || status === 'passed') summary.passed++;
    else if (status === 'fail' || status === 'failed') summary.failed++;
    else if (status === 'skip' || status === 'skipped') summary.skipped++;
  }
  summary.ok = summary.failed === 0;
  return summary;
}

module.exports = {
  generateFullMatrix,
  generateTestMatrix,
  getRequiredTestsForDashboardChange,
  getRequiredTestsForAgentChange,
  getRequiredTestsForExecutorChange,
  getRequiredTestsForIntegrationChange,
  getRequiredTestsForCicdChange,
  getRequiredTestsForStorageChange,
  getRequiredTestsForNaturalChatChange,
  summarizeTestResults
};

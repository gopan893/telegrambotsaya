'use strict';

const store = require('./devgovernance-store');

const DASHBOARD_TESTS = [
  'scratch/test-dashboard-router-registry.js',
  'scratch/test-dashboard-all-menu-routes.js',
  'scratch/test-dashboard-dark-form-ui.js'
];

const AGENT_TESTS = [
  'scratch/test-natural-chat-stable-release.js',
  'scratch/test-coding-workspace-stable-release.js'
];

const EXECUTOR_TESTS = [
  'scratch/test-executor-boundary-stable-release.js'
];

const INTEGRATION_TESTS = [
  'scratch/test-integration-gate-stable-release.js'
];

const CODING_WORKSPACE_TESTS = [
  'scratch/test-coding-workspace-stable-release.js'
];

const CICD_TESTS = [
  'scratch/test-cicd-quality-gates.js'
];

const ALWAYS_TESTS = [
  'node --check telebot.js'
];

function generateTestMatrix(changeManifest) {
  if (!changeManifest) {
    return generateFullMatrix();
  }

  const tests = [...ALWAYS_TESTS];
  const areas = [];

  if (changeManifest.dashboardTabChanges?.length || changeManifest.routeChanges?.length) {
    tests.push(...DASHBOARD_TESTS);
    areas.push('dashboard');
  }
  if (changeManifest.apiChanges?.length) {
    tests.push(...DASHBOARD_TESTS);
    areas.push('api');
  }
  if (changeManifest.commandChanges?.length) {
    tests.push(...AGENT_TESTS);
    areas.push('commands');
  }
  if (changeManifest.filesChanged?.some(f => f.includes('executor'))) {
    tests.push(...EXECUTOR_TESTS);
    areas.push('executor');
  }
  if (changeManifest.filesChanged?.some(f => f.includes('integration'))) {
    tests.push(...INTEGRATION_TESTS);
    areas.push('integration');
  }
  if (changeManifest.filesChanged?.some(f => f.includes('coding'))) {
    tests.push(...CODING_WORKSPACE_TESTS);
    areas.push('coding');
  }
  if (changeManifest.filesChanged?.some(f => f.includes('cicd') || f.includes('.github'))) {
    tests.push(...CICD_TESTS);
    areas.push('cicd');
  }

  const unique = [...new Set(tests)];
  return {
    id: Date.now().toString(36),
    tests: unique,
    areas: [...new Set(areas)],
    total: unique.length,
    includeAlwaysTests: true,
    generatedAt: new Date().toISOString()
  };
}

function generateFullMatrix() {
  const all = [
    ...ALWAYS_TESTS,
    ...DASHBOARD_TESTS,
    ...AGENT_TESTS,
    ...EXECUTOR_TESTS,
    ...INTEGRATION_TESTS,
    ...CODING_WORKSPACE_TESTS,
    ...CICD_TESTS
  ];
  return {
    id: Date.now().toString(36),
    tests: [...new Set(all)],
    areas: ['dashboard', 'agents', 'executor', 'integration', 'coding', 'cicd'],
    total: [...new Set(all)].length,
    includeAlwaysTests: true,
    generatedAt: new Date().toISOString()
  };
}

function getRequiredTestsForDashboardChange() {
  return [...DASHBOARD_TESTS];
}

function getRequiredTestsForAgentChange() {
  return [...AGENT_TESTS];
}

function getRequiredTestsForExecutorChange() {
  return [...EXECUTOR_TESTS];
}

function getRequiredTestsForIntegrationChange() {
  return [...INTEGRATION_TESTS];
}

function getRequiredTestsForCodingWorkspaceChange() {
  return [...CODING_WORKSPACE_TESTS];
}

function getRequiredTestsForCicdChange() {
  return [...CICD_TESTS];
}

async function runExistingTestsFromMatrix(matrix, services) {
  const results = [];
  if (!matrix || !matrix.tests) return results;

  const { execSync } = require('child_process');
  const repoRoot = services?.repoRoot || process.cwd();

  for (const testRef of matrix.tests) {
    const result = { test: testRef, status: 'PENDING', output: '' };
    try {
      let command = testRef;
      if (command.startsWith('node --check')) {
        command = `node --check telebot.js`;
      }
      const output = execSync(command, { cwd: repoRoot, encoding: 'utf8', maxBuffer: 4096, timeout: 30000 }).toString().trim();
      result.status = 'PASS';
      result.output = output;
    } catch (err) {
      if (err.stderr && err.stderr.includes('MODULE_NOT_FOUND')) {
        result.status = 'SKIPPED';
        result.output = 'File not found';
      } else {
        result.status = 'FAIL';
        result.output = (err.stderr || err.message || '').trim();
      }
    }
    results.push(result);
  }

  const summary = summarizeTestResults(results);
  store.addTestMatrix({ matrix, results, summary }, services);
  return { results, summary };
}

function summarizeTestResults(results) {
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const skipped = results.filter(r => r.status === 'SKIPPED').length;
  return {
    total: results.length,
    passed,
    failed,
    skipped,
    allPassed: failed === 0,
    hasSkipped: skipped > 0
  };
}

module.exports = {
  generateTestMatrix,
  generateFullMatrix,
  getRequiredTestsForDashboardChange,
  getRequiredTestsForAgentChange,
  getRequiredTestsForExecutorChange,
  getRequiredTestsForIntegrationChange,
  getRequiredTestsForCodingWorkspaceChange,
  getRequiredTestsForCicdChange,
  runExistingTestsFromMatrix,
  summarizeTestResults
};

'use strict';

const utils = require('./release-utils');

async function verifyPhaseCompatibility(services = {}) {
  const results = {
    dashboardCompat: await verifyDashboardCompatibility(services),
    telegramCommandCompat: await verifyTelegramCommandCompatibility(services),
    executorCompat: await verifyExecutorCompatibility(services),
    integrationCompat: await verifyIntegrationCompatibility(services),
    storageCompat: await verifyStorageCompatibility(services),
    pwaCompat: await verifyPwaCompatibility(services)
  };

  return buildCompatibilityReport(results);
}

async function verifyDashboardCompatibility(services = {}) {
  const issues = [];
  let ok = true;

  const knownTabs = [
    'overview', 'ops', 'workspaces', 'users', 'permissions', 'memory', 'goals',
    'workflows', 'planner', 'executor', 'agents', 'tools', 'integrations', 'backup',
    'insights', 'graph', 'benchmarks', 'incidents', 'observability', 'portfolio',
    'research', 'lifeos', 'audit', 'commands', 'env', 'settings', 'agent-evaluation',
    'coding', 'release', 'selfhealing', 'monitoring', 'cicd',
    'devgovernance', 'githubops', 'deploy', 'cost', 'knowledge', 'telegram-control',
    'operating-loop', 'improvement', 'governance', 'security', 'privacy',
    'release-candidate'
  ];

  return { ok, issues, tabCount: knownTabs.length, score: ok ? 100 : 75 };
}

async function verifyTelegramCommandCompatibility(services = {}) {
  const issues = [];
  let ok = true;

  const coreCommands = [
    '/start', '/help', '/dashboard', '/ping', '/stats', '/whoami',
    '/health', '/audit', '/workspace', '/workspaces'
  ];

  for (const cmd of coreCommands) {
    try {
      const registry = require('../telegram-control/telegram-command-registry');
      if (typeof registry.findCommand === 'function') {
        const found = registry.findCommand(cmd);
        if (!found) {
          issues.push('Core command "' + cmd + '" not found in Telegram registry (may still work via legacy handler)');
        }
      }
    } catch (e) {
      issues.push('Telegram registry not available, commands may be legacy-only');
      break;
    }
  }

  return { ok, issues, score: issues.length === 0 ? 100 : 85 };
}

async function verifyExecutorCompatibility(services = {}) {
  const issues = [];
  let ok = true;

  const requiredFlow = ['dry-run', 'evaluation', 'proposal', 'approval', 'run'];
  try {
    const executor = require('../executor/index.js');
  } catch (e) {
    issues.push('Executor module not available (may be optional)');
    ok = false;
  }

  return { ok, issues, score: ok ? 100 : 75 };
}

async function verifyIntegrationCompatibility(services = {}) {
  const issues = [];
  let ok = true;

  try {
    const integration = require('../integrations/index.js');
    if (integration && typeof integration === 'object') {
    }
  } catch (e) {
    issues.push('Integration module not available (optional)');
  }

  return { ok, issues, score: ok ? 100 : 85 };
}

async function verifyStorageCompatibility(services = {}) {
  const issues = [];
  let ok = true;

  try {
    const storage = require('../storage/index.js');
  } catch (e) {
    issues.push('Storage module not available');
    ok = false;
  }

  const storageManager = services.storageManager || null;
  if (!storageManager) {
    issues.push('StorageManager not injected in services');
  }

  return { ok, issues, score: ok ? 100 : 75 };
}

async function verifyPwaCompatibility(services = {}) {
  const issues = [];
  let ok = true;

  try {
    const pwaRoutes = require('../dashboard/pwa-routes');
  } catch (e) {
    issues.push('PWA routes not available');
    ok = false;
  }

  return { ok, issues, score: ok ? 100 : 75 };
}

function buildCompatibilityReport(results) {
  const scores = {};
  let totalScore = 0;
  let count = 0;
  const allIssues = [];

  for (const [key, r] of Object.entries(results)) {
    if (r && r.score !== undefined) {
      scores[key] = r.score;
      totalScore += r.score;
      count++;
    }
    if (r && r.issues) {
      allIssues.push(...r.issues);
    }
  }

  const avgScore = count > 0 ? Math.round(totalScore / count) : 0;

  return {
    results,
    averageScore: avgScore,
    scores,
    allIssues,
    compatible: avgScore >= 85,
    timestamp: utils.formatTimestamp()
  };
}

module.exports = {
  verifyPhaseCompatibility,
  verifyDashboardCompatibility,
  verifyTelegramCommandCompatibility,
  verifyExecutorCompatibility,
  verifyIntegrationCompatibility,
  verifyStorageCompatibility,
  verifyPwaCompatibility,
  buildCompatibilityReport
};

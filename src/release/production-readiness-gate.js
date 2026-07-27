'use strict';

const utils = require('./release-utils');

async function runProductionReadinessGate(services = {}) {
  const results = {
    boot: await checkBootReadiness(services),
    dashboard: await checkDashboardReadiness(services),
    telegram: await checkTelegramReadiness(services),
    storage: await checkStorageReadiness(services),
    governance: await checkGovernanceReadiness(services),
    security: await checkSecurityReadiness(services),
    privacy: await checkPrivacyReadiness(services),
    deploy: await checkDeployReadiness(services),
    blockers: await checkReleaseBlockers(services)
  };

  return buildProductionReadinessReport(results);
}

async function checkBootReadiness(services = {}) {
  const env = services.env || process.env || {};
  const issues = [];
  let ok = true;

  if (!env.NODE_ENV) {
    issues.push('NODE_ENV not set');
    ok = false;
  }
  if (!env.PORT) {
    issues.push('PORT not set');
    ok = false;
  }
  if (!env.TELEGRAM_TOKEN) {
    issues.push('TELEGRAM_TOKEN not set');
    ok = false;
  }
  if (!env.DATABASE_URL && !env.STORAGE_DRIVER) {
    issues.push('Neither DATABASE_URL nor STORAGE_DRIVER set');
    ok = false;
  }

  try {
    require.resolve('../bot/index.js');
  } catch (e) {
    issues.push('Main bot module not found: ' + e.message);
    ok = false;
  }

  return { ok, issues, score: ok ? 100 : 0 };
}

async function checkDashboardReadiness(services = {}) {
  const env = services.env || process.env || {};
  const issues = [];
  let ok = true;

  if (!env.DASHBOARD_ADMIN_TOKEN) {
    issues.push('DASHBOARD_ADMIN_TOKEN not set');
    ok = false;
  }

  const knownTabs = [
    'overview', 'ops', 'workspaces', 'users', 'permissions', 'memory', 'goals',
    'workflows', 'planner', 'executor', 'agents', 'tools', 'integrations', 'backup',
    'insights', 'graph', 'benchmarks', 'incidents', 'observability', 'portfolio',
    'research', 'lifeos', 'audit', 'commands', 'env', 'settings', 'agent-evaluation',
    'coding', 'release', 'routines', 'selfhealing', 'monitoring', 'cicd',
    'devgovernance', 'githubops', 'deploy', 'cost', 'knowledge', 'telegram-control',
    'operating-loop', 'improvement', 'governance', 'security', 'privacy',
    'release-candidate'
  ];

  return { ok, issues, score: ok ? 100 : 50, knownTabs };
}

async function checkTelegramReadiness(services = {}) {
  const env = services.env || process.env || {};
  const issues = [];
  let ok = true;

  if (!env.TELEGRAM_TOKEN) {
    issues.push('TELEGRAM_TOKEN not set');
    ok = false;
  }
  if (!env.WEBHOOK_URL) {
    issues.push('WEBHOOK_URL not set');
    ok = false;
  }
  if (!env.OWNER_CHAT_ID) {
    issues.push('OWNER_CHAT_ID not set');
    ok = false;
  }

  return { ok, issues, score: ok ? 100 : 0 };
}

async function checkStorageReadiness(services = {}) {
  const env = services.env || process.env || {};
  const issues = [];
  let ok = true;

  const storageDriver = env.STORAGE_DRIVER || 'postgres';
  if (storageDriver === 'postgres' && !env.DATABASE_URL) {
    issues.push('DATABASE_URL required for postgres storage driver');
    ok = false;
  }

  return { ok, issues, score: ok ? 100 : 0 };
}

async function checkGovernanceReadiness(services = {}) {
  const issues = [];
  let ok = true;

  try {
    const governance = require('../governance/index.js');
    if (governance && typeof governance === 'object') {
    }
  } catch (e) {
    issues.push('Governance module not available: ' + e.message);
    ok = false;
  }

  return { ok, issues, score: ok ? 100 : 50 };
}

async function checkSecurityReadiness(services = {}) {
  const env = services.env || process.env || {};
  const issues = [];
  let ok = true;

  if (env.AUTO_APPROVE_ENABLED === 'true') {
    issues.push('CRITICAL: AUTO_APPROVE_ENABLED=true detected');
    ok = false;
  }
  if (env.AUTO_RUN_ENABLED === 'true') {
    issues.push('CRITICAL: AUTO_RUN_ENABLED=true detected');
    ok = false;
  }
  if (env.SHELL_EXECUTOR_ENABLED === 'true') {
    issues.push('CRITICAL: SHELL_EXECUTOR_ENABLED=true detected');
    ok = false;
  }

  const hasTokenTypo = Object.keys(env).some(k => /^TELEGRAM_TOKEN_PLANNE?/i.test(k));
  if (hasTokenTypo) {
    issues.push('Typo detected: TELEGRAM_TOKEN_PLANNE found in env');
    ok = false;
  }

  return { ok, issues, score: ok ? 100 : 0 };
}

async function checkPrivacyReadiness(services = {}) {
  const issues = [];
  let ok = true;

  try {
    const privacy = require('../privacy/index.js');
  } catch (e) {
    issues.push('Privacy module not available');
    ok = false;
  }

  return { ok, issues, score: ok ? 100 : 50 };
}

async function checkDeployReadiness(services = {}) {
  const issues = [];
  let ok = true;

  try {
    const deploy = require('../deploy/index.js');
  } catch (e) {
    issues.push('Deploy module not available');
  }

  return { ok, issues, score: ok ? 100 : 75 };
}

async function checkReleaseBlockers(services = {}) {
  const env = services.env || process.env || {};
  const blockers = [];

  if (env.AUTO_APPROVE_ENABLED === 'true') {
    blockers.push({ severity: 'critical', message: 'AUTO_APPROVE_ENABLED=true blocks production release' });
  }
  if (env.AUTO_RUN_ENABLED === 'true') {
    blockers.push({ severity: 'critical', message: 'AUTO_RUN_ENABLED=true blocks production release' });
  }
  if (env.SHELL_EXECUTOR_ENABLED === 'true') {
    blockers.push({ severity: 'critical', message: 'SHELL_EXECUTOR_ENABLED=true blocks production release' });
  }
  if (!env.TELEGRAM_TOKEN) {
    blockers.push({ severity: 'critical', message: 'TELEGRAM_TOKEN not configured' });
  }
  if (!env.OWNER_CHAT_ID) {
    blockers.push({ severity: 'high', message: 'OWNER_CHAT_ID not configured' });
  }
  if (!env.DASHBOARD_ADMIN_TOKEN) {
    blockers.push({ severity: 'high', message: 'DASHBOARD_ADMIN_TOKEN not configured' });
  }
  if (!env.WEBHOOK_URL) {
    blockers.push({ severity: 'high', message: 'WEBHOOK_URL not configured' });
  }

  return { blockers, blocked: blockers.some(b => b.severity === 'critical'), count: blockers.length };
}

function buildProductionReadinessReport(results) {
  const allOk = Object.values(results).every(r => {
    if (r && r.ok !== undefined) return r.ok === true;
    if (r && r.blockers) return r.blockers.length === 0;
    return true;
  });

  const scores = {};
  let totalScore = 0;
  let count = 0;
  for (const [key, r] of Object.entries(results)) {
    if (r && r.score !== undefined) {
      scores[key] = r.score;
      totalScore += r.score;
      count++;
    }
  }
  const avgScore = count > 0 ? Math.round(totalScore / count) : 0;
  const blockers = results.blockers ? results.blockers.blockers || [] : [];

  return {
    results,
    allReady: allOk,
    averageScore: avgScore,
    scores,
    blockers,
    blockedBy: blockers.filter(b => b.severity === 'critical').map(b => b.message),
    releaseGatesPassed: allOk && avgScore >= 90,
    timestamp: utils.formatTimestamp()
  };
}

module.exports = {
  runProductionReadinessGate,
  checkBootReadiness,
  checkDashboardReadiness,
  checkTelegramReadiness,
  checkStorageReadiness,
  checkGovernanceReadiness,
  checkSecurityReadiness,
  checkPrivacyReadiness,
  checkDeployReadiness,
  checkReleaseBlockers,
  buildProductionReadinessReport
};

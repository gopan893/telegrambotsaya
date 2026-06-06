'use strict';

const sanitizer = require('./observability-sanitizer');
const utils = require('./observability-utils');

function safeStatus(fn, fallback = { status: 'unknown' }) {
  try {
    return fn();
  } catch (err) {
    return { ...fallback, status: 'degraded', warning: sanitizer.redactText(err.message) };
  }
}

function normalizeStorageStatus(raw = {}) {
  const status = raw.storage || raw;
  return sanitizer.sanitize({
    activeDriver: status.activeDriver || status.storageDriver || status.driver || 'unknown',
    fallbackActive: Boolean(status.fallbackActive),
    fallbackReason: status.fallbackReason || '',
    postgresAvailable: Boolean(status.postgresAvailable || status.postgres?.available),
    postgresTableReady: Boolean(status.postgresTableReady || status.postgres?.tableReady),
    postgresStatus: status.postgresStatus || status.postgres?.status || 'unknown',
    redisAvailable: Boolean(status.redisAvailable || status.redis?.available),
    redisStatus: status.redisStatus || status.redis?.status || 'unknown',
    redisConfigured: Boolean(status.redisUrlConfigured || status.redis?.configured)
  });
}

function checkAppHealth(services = {}) {
  return safeStatus(() => ({
    id: 'app',
    label: 'Application runtime',
    status: 'healthy',
    details: {
      uptimeSec: Math.round(process.uptime()),
      nodeVersion: process.version,
      pid: process.pid,
      memoryRssMb: Math.round(process.memoryUsage().rss / 1024 / 1024)
    }
  }));
}

function checkDashboardHealth(services = {}) {
  return safeStatus(() => {
    const enabled = services.env?.dashboard?.enabled ?? services.env?.DASHBOARD_ENABLED;
    const tokenConfigured = services.env?.dashboard?.adminToken || services.env?.DASHBOARD_ADMIN_TOKEN;
    const warnings = [];
    if (!enabled && String(enabled).toLowerCase() !== 'true') warnings.push('Dashboard may be disabled.');
    if (!tokenConfigured) warnings.push('Dashboard admin token missing.');
    return {
      id: 'dashboard',
      label: 'Dashboard',
      status: warnings.length ? 'degraded' : 'healthy',
      warnings,
      details: {
        dashboardEnabled: Boolean(enabled === true || String(enabled).toLowerCase() === 'true'),
        tokenConfigured: Boolean(tokenConfigured)
      }
    };
  });
}

function checkTelegramWebhookHealth(services = {}) {
  return safeStatus(() => {
    const env = services.env || process.env;
    const tokenConfigured = Boolean(env.TELEGRAM_TOKEN || env.telegram?.token);
    const webhookConfigured = Boolean(env.WEBHOOK_URL || env.TELEGRAM_WEBHOOK_URL || env.telegram?.webhookUrl);
    const warnings = [];
    if (!tokenConfigured) warnings.push('Telegram token is not configured.');
    if (!webhookConfigured) warnings.push('Webhook URL not configured; polling/local mode may still work.');
    return {
      id: 'telegram_webhook',
      label: 'Telegram webhook',
      status: tokenConfigured ? (webhookConfigured ? 'healthy' : 'degraded') : 'unhealthy',
      warnings,
      blockers: tokenConfigured ? [] : ['Telegram token missing.'],
      details: { tokenConfigured, webhookConfigured }
    };
  });
}

function checkStorageHealth(services = {}) {
  return safeStatus(() => {
    const raw = services.storageManager?.getStorageStatus?.() || {};
    const storage = normalizeStorageStatus(raw);
    const blockers = [];
    const warnings = [];
    if (storage.activeDriver === 'postgres' && storage.postgresAvailable && storage.postgresTableReady) {
      return { id: 'storage', label: 'PostgreSQL storage', status: 'healthy', details: storage };
    }
    if (storage.fallbackActive || storage.activeDriver === 'json') warnings.push('Storage is using JSON fallback.');
    if (!storage.postgresAvailable && storage.activeDriver !== 'json') blockers.push('PostgreSQL unavailable.');
    return {
      id: 'storage',
      label: 'Storage',
      status: blockers.length ? 'unhealthy' : 'degraded',
      warnings,
      blockers,
      details: storage
    };
  });
}

function checkRedisHealth(services = {}) {
  return safeStatus(() => {
    const raw = services.storageManager?.getStorageStatus?.() || {};
    const storage = normalizeStorageStatus(raw);
    if (!storage.redisConfigured) {
      return { id: 'redis', label: 'Redis cache', status: 'degraded', warnings: ['REDIS_URL not configured.'], details: storage };
    }
    return {
      id: 'redis',
      label: 'Redis cache',
      status: storage.redisAvailable ? 'healthy' : 'degraded',
      warnings: storage.redisAvailable ? [] : ['Redis unavailable; fallback cache should be used.'],
      details: storage
    };
  });
}

function checkEvaluationGateHealth(services = {}) {
  return safeStatus(() => {
    const evaluation = services.evaluationSystem || services.smartAgentSystem?.agentEvaluationV2 || services.agentEvaluationV2;
    const available = Boolean(evaluation?.runEvaluationSuite || evaluation?.harness?.runEvaluationSuite || evaluation?.runEvalCases);
    return {
      id: 'evaluation_gate',
      label: 'Evaluation Harness v2',
      status: available ? 'healthy' : 'degraded',
      warnings: available ? [] : ['Evaluation gate not available; risky proposals should stay blocked.'],
      details: { available }
    };
  });
}

function checkExecutorBoundaryHealth(services = {}) {
  return safeStatus(() => {
    const executor = services.executorSystem || require('../executor');
    const registry = executor.executorRegistry || executor.registry;
    const proposalAvailable = Boolean(executor.executionPlanner?.createExecutionProposal);
    const runAvailable = Boolean(executor.approvedRunner?.runApprovedExecution);
    const registered = registry?.listExecutors?.() || [];
    const ok = proposalAvailable && runAvailable && registered.length > 0;
    return {
      id: 'executor_boundary',
      label: 'Executor approval boundary',
      status: ok ? 'healthy' : 'unhealthy',
      blockers: ok ? [] : ['Executor proposal/run boundary unavailable.'],
      details: { proposalAvailable, runAvailable, registeredActions: registered.length }
    };
  });
}

function checkIntegrationGateHealth(services = {}) {
  return safeStatus(() => {
    const integrations = services.integrationsSystem || null;
    const available = Boolean(integrations || services.integrationExecutionSystem || services.integrationPlanner);
    return {
      id: 'integration_gate',
      label: 'External integration gate',
      status: available ? 'healthy' : 'degraded',
      warnings: available ? [] : ['Integration planner optional module not loaded.'],
      details: { available }
    };
  });
}

function buildProductionHealthSummary(checks = []) {
  const safeChecks = checks.map(check => sanitizer.sanitize(check));
  const warnings = safeChecks.flatMap(check => check.warnings || []);
  const blockers = safeChecks.flatMap(check => check.blockers || []);
  const status = blockers.length ? 'unhealthy' : utils.statusFromChecks(safeChecks);
  return sanitizer.sanitize({
    status,
    checks: safeChecks,
    warnings,
    blockers,
    createdAt: utils.nowIso()
  });
}

async function runProductionHealthCheck(services = {}) {
  const checks = [
    checkAppHealth(services),
    checkDashboardHealth(services),
    checkTelegramWebhookHealth(services),
    checkStorageHealth(services),
    checkRedisHealth(services),
    checkEvaluationGateHealth(services),
    checkExecutorBoundaryHealth(services),
    checkIntegrationGateHealth(services)
  ];
  const summary = buildProductionHealthSummary(checks);
  try {
    services.monitoringSystem?.emit?.('observability', summary.status === 'healthy' ? 'info' : 'warning', 'Production health check', `Status: ${summary.status}`, 'observability');
  } catch (_) {}
  return summary;
}

module.exports = {
  buildProductionHealthSummary,
  checkAppHealth,
  checkDashboardHealth,
  checkEvaluationGateHealth,
  checkExecutorBoundaryHealth,
  checkIntegrationGateHealth,
  checkRedisHealth,
  checkStorageHealth,
  checkTelegramWebhookHealth,
  runProductionHealthCheck
};

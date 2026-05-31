'use strict';

const diagnosticsEngine = require('../ops/diagnostics-engine');
const benchmarkEngine = require('../ops/benchmark-engine');
const telemetryCollector = require('../ops/telemetry-collector');
const serializers = require('./dashboard-serializers');

function getOpsServices(services = {}) {
  return typeof services.getOpsServices === 'function' ? services.getOpsServices() : services;
}

function recordDashboardAction(actionName, services = {}, status = 'ok') {
  try {
    services.opsSystem?.telemetry?.recordToolUsage?.({
      tool: 'dashboard_action',
      success: status === 'ok',
      meta: { actionName }
    }, getOpsServices(services));
  } catch (_) {}
}

function buildActionResponse(actionName, status, result = null, warnings = []) {
  return {
    ok: status === 'ok',
    action: actionName,
    status,
    result,
    warnings,
    timestamp: new Date().toISOString()
  };
}

function getStorageStatus(services = {}) {
  try {
    return services.storageManager?.getStorageStatus?.() || services.storageManager?.status?.() || {};
  } catch (err) {
    return { status: 'unavailable', errorMessageSafe: err.message };
  }
}

function countAiosData(services = {}) {
  const users = typeof services.getUsersSnapshot === 'function' ? services.getUsersSnapshot() : {};
  return Object.entries(users || {}).reduce((acc, [userId, user]) => {
    const aios = user?.aios || {};
    acc.totalUsers += 1;
    acc.users.push({
      userId,
      memoryCount: Array.isArray(aios.memories) ? aios.memories.length : 0,
      goalCount: Array.isArray(aios.goals) ? aios.goals.length : 0,
      workflowCount: Array.isArray(aios.workflows) ? aios.workflows.length : 0,
      insightCount: Array.isArray(aios.insights) ? aios.insights.length : 0,
      graphNodeCount: Array.isArray(aios.graph?.nodes) ? aios.graph.nodes.length : 0,
      graphEdgeCount: Array.isArray(aios.graph?.edges) ? aios.graph.edges.length : 0
    });
    return acc;
  }, { totalUsers: 0, users: [] });
}

function buildHealthReport(services = {}) {
  const storage = serializers.sanitizeStorage(getStorageStatus(services));
  let opsStatus = null;
  try {
    opsStatus = services.opsSystem?.getStatus?.(getOpsServices(services)) || null;
  } catch (err) {
    opsStatus = { status: 'unavailable', errorMessageSafe: err.message };
  }
  return {
    generatedAt: new Date().toISOString(),
    storage,
    ops: serializers.sanitizeOps(opsStatus || {}),
    env: serializers.sanitizeEnvStatus(services.env || process.env)
  };
}

async function buildUserSummaryReport(services = {}, payload = {}) {
  const userId = String(payload.userId || '').trim();
  const snapshot = countAiosData(services);
  if (!userId) {
    return {
      generatedAt: new Date().toISOString(),
      totalUsers: snapshot.totalUsers,
      users: snapshot.users.slice(0, 50)
    };
  }

  const users = typeof services.getUsersSnapshot === 'function' ? services.getUsersSnapshot() : {};
  const user = users[userId] || {};
  const aios = user.aios || {};
  return {
    generatedAt: new Date().toISOString(),
    userId,
    memoryCount: Array.isArray(aios.memories) ? aios.memories.length : 0,
    goalCount: Array.isArray(aios.goals) ? aios.goals.length : 0,
    workflowCount: Array.isArray(aios.workflows) ? aios.workflows.length : 0,
    insightCount: Array.isArray(aios.insights) ? aios.insights.length : 0,
    graphNodeCount: Array.isArray(aios.graph?.nodes) ? aios.graph.nodes.length : 0,
    graphEdgeCount: Array.isArray(aios.graph?.edges) ? aios.graph.edges.length : 0,
    recentGoals: Array.isArray(aios.goals) ? aios.goals.slice(-10).map(serializers.sanitizeGoal) : [],
    recentInsights: Array.isArray(aios.insights) ? aios.insights.slice(-10).map(serializers.sanitizeInsight) : []
  };
}

async function handleAction(actionName, services = {}, payload = {}) {
  const opsServices = getOpsServices(services);
  switch (actionName) {
    case 'diagnostics/run': {
      if (!diagnosticsEngine.runDiagnostics && !diagnosticsEngine.diagnose) {
        recordDashboardAction(actionName, services, 'fail');
        return buildActionResponse(actionName, 'unavailable', null, ['DIAGNOSTICS_UNAVAILABLE']);
      }
      const result = diagnosticsEngine.runDiagnostics
        ? diagnosticsEngine.runDiagnostics(opsServices)
        : diagnosticsEngine.diagnose(opsServices);
      recordDashboardAction(actionName, services);
      return buildActionResponse(actionName, 'ok', result);
    }
    case 'benchmark/run-light': {
      if (!benchmarkEngine.runBenchmarkSuite) {
        recordDashboardAction(actionName, services, 'fail');
        return buildActionResponse(actionName, 'unavailable', null, ['BENCHMARK_UNAVAILABLE']);
      }
      const result = benchmarkEngine.runBenchmarkSuite(null, opsServices, { full: false });
      recordDashboardAction(actionName, services);
      return buildActionResponse(actionName, 'ok', result);
    }
    case 'telemetry/prune': {
      if (!telemetryCollector.pruneTelemetry) {
        recordDashboardAction(actionName, services, 'fail');
        return buildActionResponse(actionName, 'unavailable', null, ['TELEMETRY_UNAVAILABLE']);
      }
      const result = telemetryCollector.pruneTelemetry(opsServices);
      recordDashboardAction(actionName, services);
      return buildActionResponse(actionName, 'ok', result);
    }
    case 'ops/refresh': {
      let status = { status: 'unknown' };
      if (services.opsSystem?.getStatus) {
        status = services.opsSystem.getStatus(opsServices);
      }
      if (services.storageManager?.refreshStorageHealth) {
        await services.storageManager.refreshStorageHealth({ force: true });
      }
      recordDashboardAction(actionName, services);
      return buildActionResponse(actionName, 'ok', status);
    }
    case 'report/export-health': {
      const result = buildHealthReport(services);
      recordDashboardAction(actionName, services);
      return buildActionResponse(actionName, 'ok', result);
    }
    case 'report/export-user-summary': {
      const result = await buildUserSummaryReport(services, payload);
      recordDashboardAction(actionName, services);
      return buildActionResponse(actionName, 'ok', result);
    }
    default:
      return buildActionResponse(actionName, 'invalid', null, ['INVALID_ACTION']);
  }
}

module.exports = {
  buildActionResponse,
  buildHealthReport,
  buildUserSummaryReport,
  handleAction
};

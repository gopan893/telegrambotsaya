'use strict';

const diagnosticsEngine = require('../ops/diagnostics-engine');
const benchmarkEngine = require('../ops/benchmark-engine');
const telemetryCollector = require('../ops/telemetry-collector');

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

async function handleAction(actionName, services) {
  const opsServices = getOpsServices(services);
  switch (actionName) {
    case 'diagnostics/run': {
      if (!diagnosticsEngine.runDiagnostics && !diagnosticsEngine.diagnose) {
        recordDashboardAction(actionName, services, 'fail');
        return { ok: false, error: 'DIAGNOSTICS_UNAVAILABLE' };
      }
      const result = diagnosticsEngine.runDiagnostics
        ? diagnosticsEngine.runDiagnostics(opsServices)
        : diagnosticsEngine.diagnose(opsServices);
      recordDashboardAction(actionName, services);
      return { ok: true, result };
    }
    case 'benchmark/run-light': {
      if (!benchmarkEngine.runBenchmarkSuite) {
        recordDashboardAction(actionName, services, 'fail');
        return { ok: false, error: 'BENCHMARK_UNAVAILABLE' };
      }
      const result = benchmarkEngine.runBenchmarkSuite(null, opsServices, { full: false });
      recordDashboardAction(actionName, services);
      return { ok: true, result };
    }
    case 'telemetry/prune': {
      if (!telemetryCollector.pruneTelemetry) {
        recordDashboardAction(actionName, services, 'fail');
        return { ok: false, error: 'TELEMETRY_UNAVAILABLE' };
      }
      const result = telemetryCollector.pruneTelemetry(opsServices);
      recordDashboardAction(actionName, services);
      return { ok: true, result };
    }
    case 'ops/refresh': {
      let status = { status: 'unknown' };
      if (services.opsSystem?.getStatus) {
        status = services.opsSystem.getStatus(opsServices);
      }
      recordDashboardAction(actionName, services);
      return { ok: true, status };
    }
    default:
      return { ok: false, error: 'INVALID_ACTION' };
  }
}

module.exports = {
  handleAction
};

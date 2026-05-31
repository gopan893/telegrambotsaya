'use strict';

const diagnosticsEngine = require('../ops/diagnostics-engine');
const benchmarkEngine = require('../ops/benchmark-engine');
const telemetryCollector = require('../ops/telemetry-collector');

async function handleAction(actionName, services) {
  switch (actionName) {
    case 'diagnostics/run': {
      if (!diagnosticsEngine.runDiagnostics) {
        return { ok: false, error: 'DIAGNOSTICS_UNAVAILABLE' };
      }
      const result = diagnosticsEngine.runDiagnostics(services);
      return { ok: true, result };
    }
    case 'benchmark/run-light': {
      if (!benchmarkEngine.runBenchmarkSuite) {
        return { ok: false, error: 'BENCHMARK_UNAVAILABLE' };
      }
      const result = benchmarkEngine.runBenchmarkSuite({ full: false }, services);
      return { ok: true, result };
    }
    case 'telemetry/prune': {
      if (!telemetryCollector.pruneTelemetry) {
        return { ok: false, error: 'TELEMETRY_UNAVAILABLE' };
      }
      const result = telemetryCollector.pruneTelemetry(services);
      return { ok: true, result };
    }
    case 'ops/refresh': {
      let status = { status: 'unknown' };
      if (services.opsSystem?.getStatus) {
        status = services.opsSystem.getStatus(services);
      }
      return { ok: true, status };
    }
    default:
      return { ok: false, error: 'INVALID_ACTION' };
  }
}

module.exports = {
  handleAction
};

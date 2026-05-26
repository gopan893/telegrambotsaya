'use strict';

const benchmarkEngine = require('./benchmark-engine');
const telemetryCollector = require('./telemetry-collector');

function detectRegression(services = {}) {
  const history = benchmarkEngine.getBenchmarkHistory(services, 10);
  const latest = history[history.length - 1];
  const baseline = history.find(run => run.passed) || history[0];
  const comparison = benchmarkEngine.compareBenchmarkRuns(baseline, latest);
  const telemetry = telemetryCollector.getTelemetrySummary(services);
  const findings = [];

  if (comparison.regression) {
    findings.push({
      metric: 'benchmark_score',
      before: comparison.beforeScore,
      after: comparison.afterScore,
      severity: comparison.delta <= -0.15 ? 'high' : 'medium',
      recommendation: 'Bandingkan commit terakhir dengan benchmark sebelumnya dan cek modul yang baru berubah.'
    });
  }

  if (telemetry.latency.p90 >= 9000) {
    findings.push({
      metric: 'latency_p90',
      before: '<9000',
      after: telemetry.latency.p90,
      severity: 'medium',
      recommendation: 'Kurangi deep reasoning untuk pesan sederhana dan cek provider latency.'
    });
  }

  if (telemetry.recentErrorCount >= 8) {
    findings.push({
      metric: 'error_spike',
      before: '<8',
      after: telemetry.recentErrorCount,
      severity: 'high',
      recommendation: 'Buka /diagnose dan cek incident terbaru.'
    });
  }

  const worst = findings.find(item => item.severity === 'high') || findings[0];
  return {
    regressionDetected: findings.length > 0,
    severity: worst?.severity || 'none',
    metric: worst?.metric || 'none',
    before: worst?.before || null,
    after: worst?.after || null,
    recommendation: worst?.recommendation || 'Tidak ada regresi yang terlihat dari telemetry ringan.',
    findings
  };
}

module.exports = {
  detectRegression
};

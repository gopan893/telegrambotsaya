'use strict';

const benchmarkEngine = require('./benchmark-engine');
const telemetryCollector = require('./telemetry-collector');
const tokenAnalyzer = require('./token-analyzer');

function addFinding(findings, metric, baselineValue, currentValue, severity, possibleCause, recommendation) {
  const b = Number(baselineValue || 0);
  const c = Number(currentValue || 0);
  findings.push({
    metric,
    baselineValue,
    currentValue,
    before: baselineValue,
    after: currentValue,
    delta: Number((c - b).toFixed(3)),
    severity,
    possibleCause,
    recommendation
  });
}

function compareMetric(metric, before, after) {
  const b = Number(before || 0);
  const a = Number(after || 0);
  const delta = Number((a - b).toFixed(3));
  let severity = 'none';
  if (delta < 0) {
    severity = Math.abs(delta) > 0.15 ? 'high' : 'medium';
  }
  return {
    metric,
    before: b,
    after: a,
    delta,
    severity,
    regression: delta <= -0.08
  };
}

function detectRegression(currentBenchmark, baselineBenchmark, services) {
  // Signature 1: detectRegression(currentBenchmark, baselineBenchmark) -> required
  // Signature 2: detectRegression(services = {}) -> backward compatible
  let finalServices = {};
  let current = currentBenchmark;
  let baseline = baselineBenchmark;

  if (!currentBenchmark || typeof currentBenchmark.ensureUser === 'function') {
    finalServices = currentBenchmark || {};
    current = null;
    baseline = null;
  } else {
    finalServices = services || {};
  }

  const history = benchmarkEngine.getBenchmarkHistory({}, finalServices);
  const latest = current || history[history.length - 1];
  const ref = baseline || history.find(run => run.id === latest?.baselineId) || history.find(run => run.passed) || history[0];
  const comparison = benchmarkEngine.compareBenchmarkRuns(ref, latest);
  const telemetry = telemetryCollector.getTelemetrySummary({}, finalServices);
  const token = tokenAnalyzer.summarizeTokenUsage(finalServices);
  const findings = [];

  if (comparison.regression) {
    addFinding(
      findings,
      'benchmark_score',
      comparison.beforeScore,
      comparison.afterScore,
      comparison.delta <= -0.15 ? 'high' : 'medium',
      'Skor benchmark terbaru turun dari baseline.',
      'Bandingkan commit terakhir dengan benchmark sebelumnya dan cek modul yang baru berubah.'
    );
  }

  if (telemetry.latency.p90 >= 9000) {
    addFinding(
      findings,
      'latency_p90',
      9000,
      telemetry.latency.p90,
      telemetry.latency.p90 >= 15000 ? 'high' : 'medium',
      'Latency p90 melewati batas sehat.',
      'Kurangi deep reasoning untuk pesan sederhana dan cek provider latency.'
    );
  }

  if (telemetry.recentErrorCount >= 8) {
    addFinding(
      findings,
      'error_spike',
      8,
      telemetry.recentErrorCount,
      'high',
      'Error meningkat dalam window telemetry terbaru.',
      'Buka /diag dan cek incident terbaru.'
    );
  }

  const toolEntries = Object.values(telemetry.toolUsage || {});
  const toolCalls = toolEntries.reduce((sum, item) => sum + Number(item.calls || 0), 0);
  const toolSuccess = toolEntries.reduce((sum, item) => sum + Number(item.success || 0), 0);
  const toolRate = toolCalls ? toolSuccess / toolCalls : 1;
  if (toolCalls >= 5 && toolRate < 0.85) {
    addFinding(
      findings,
      'tool_success_rate',
      0.85,
      Number(toolRate.toFixed(3)),
      toolRate < 0.65 ? 'high' : 'medium',
      'Tool execution gagal lebih sering dari batas sehat.',
      'Cek parameter tool dan provider eksternal; gunakan /recover untuk plan aman.'
    );
  }

  if (token.spike?.spike || token.averageTokens >= 2200) {
    addFinding(
      findings,
      'cost_tokens',
      token.spike?.average || 1400,
      token.spike?.last || token.averageTokens,
      token.averageTokens >= 3000 ? 'high' : 'medium',
      'Token usage meningkat atau terjadi spike.',
      'Aktifkan context compression, cache, dan benchmark sampling.'
    );
  }

  const worst = findings.find(item => item.severity === 'high') || findings[0];
  return {
    detected: findings.length > 0,
    regressionDetected: findings.length > 0,
    severity: worst?.severity || 'none',
    metric: worst?.metric || 'none',
    baselineValue: worst?.baselineValue ?? null,
    currentValue: worst?.currentValue ?? null,
    before: worst?.before ?? null,
    after: worst?.after ?? null,
    delta: worst?.delta ?? 0,
    possibleCause: worst?.possibleCause || 'Tidak ada gejala regresi kuat.',
    recommendation: worst?.recommendation || 'Tidak ada regresi yang terlihat dari telemetry ringan.',
    findings
  };
}

function getRegressionSummary(services = {}) {
  const result = detectRegression(services);
  return {
    detected: result.regressionDetected,
    severity: result.severity,
    metric: result.metric,
    recommendation: result.recommendation,
    findingCount: result.findings.length
  };
}

module.exports = {
  detectRegression,
  compareMetric,
  getRegressionSummary
};

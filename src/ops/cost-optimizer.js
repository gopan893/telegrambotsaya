'use strict';

const telemetryCollector = require('./telemetry-collector');
const tokenAnalyzer = require('./token-analyzer');
const guards = require('./ops-guards');

function analyzeCost(services = {}) {
  const telemetry = telemetryCollector.getTelemetrySummary(services);
  const token = tokenAnalyzer.summarizeTokenUsage(services);
  const recommendations = [];
  const counters = telemetry.counters || {};
  const aiCalls = Number(counters.aiCall || 0);
  const requests = Number(counters.request || 0);
  const aiPerRequest = requests ? aiCalls / requests : 0;

  if (token.averageTokens >= 1400) {
    recommendations.push({
      action: 'use_summary_context',
      reason: 'Rata-rata token tinggi.',
      confidence: 0.8,
      impact: 'Mengurangi biaya dan latency tanpa menghapus memory utama.'
    });
  }

  if (aiPerRequest > 1.4) {
    recommendations.push({
      action: 'skip_deep_reasoning_for_simple_messages',
      reason: 'AI call per request cukup tinggi.',
      confidence: 0.72,
      impact: 'Mengurangi beban provider untuk percakapan sederhana.'
    });
  }

  if (token.spike?.spike) {
    recommendations.push({
      action: 'enable_token_spike_guard',
      reason: `Token spike ${token.spike.ratio}x dari rata-rata.`,
      confidence: 0.76,
      impact: 'Mencegah prompt terlalu besar setelah perubahan sistem.'
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      action: 'keep_current_policy',
      reason: 'Tidak ada sinyal biaya yang berlebihan.',
      confidence: 0.64,
      impact: 'Stabilitas lebih penting daripada tuning agresif.'
    });
  }

  return {
    estimatedTokenUsage: token,
    aiPerRequest: Number(aiPerRequest.toFixed(2)),
    cacheHint: 'Pertahankan cache jawaban pendek dan summary context untuk query berulang.',
    recommendations: guards.preventOverOptimization(recommendations),
    generatedAt: guards.nowIso()
  };
}

module.exports = {
  analyzeCost
};

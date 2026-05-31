'use strict';

const telemetryCollector = require('./telemetry-collector');
const tokenAnalyzer = require('./token-analyzer');
const resourceAnalyzer = require('./resource-analyzer');
const guards = require('./ops-guards');

function analyzeCost(services = {}, userId = '0') {
  const telemetry = telemetryCollector.getTelemetrySummary({}, services);
  const token = tokenAnalyzer.summarizeTokenUsage(services);
  const resources = resourceAnalyzer.analyzeResources(services, userId);
  const recommendations = [];
  const counters = telemetry.counters || {};
  const aiCalls = Number(counters.aiCall || 0);
  const requests = Number(counters.request || 0);
  const aiPerRequest = requests ? aiCalls / requests : 0;

  if (token.averageTokens >= 1400) {
    recommendations.push({
      action: 'use_summary_context',
      setting: 'context_compression',
      reason: 'Rata-rata token tinggi.',
      confidence: 0.8,
      impact: 'Mengurangi biaya dan latency tanpa menghapus memory utama.'
    });
  }

  if (aiPerRequest > 1.4) {
    recommendations.push({
      action: 'skip_deep_reasoning_for_simple_messages',
      setting: 'reasoning_depth',
      reason: 'AI call per request cukup tinggi.',
      confidence: 0.72,
      impact: 'Mengurangi beban provider untuk percakapan sederhana.'
    });
  }

  if (token.spike?.spike) {
    recommendations.push({
      action: 'enable_token_spike_guard',
      setting: 'token_spike_guard',
      reason: `Token spike ${token.spike.ratio}x dari rata-rata.`,
      confidence: 0.76,
      impact: 'Mencegah prompt terlalu besar setelah perubahan sistem.'
    });
  }

  if (resources.memory.telemetrySizeBytes > 120000) {
    recommendations.push({
      action: 'prune_telemetry',
      setting: 'prune_telemetry',
      reason: 'Telemetry mulai membesar.',
      confidence: 0.78,
      impact: 'Mengurangi storage ops tanpa menyentuh memory user.'
    });
  }

  if (resources.workflow.stuckWorkflowCount > 0) {
    recommendations.push({
      action: 'review_stuck_workflows',
      setting: 'stuck_workflows',
      reason: 'Ada workflow stale/conflict.',
      confidence: 0.7,
      impact: 'Meningkatkan throughput kerja jangka panjang.'
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      action: 'keep_current_policy',
      setting: 'policy',
      reason: 'Tidak ada sinyal biaya yang berlebihan.',
      confidence: 0.64,
      impact: 'Stabilitas lebih penting daripada tuning agresif.'
    });
  }

  return {
    estimatedTokenUsage: token,
    resources,
    aiPerRequest: Number(aiPerRequest.toFixed(2)),
    cacheHint: 'Pertahankan cache jawaban pendek dan summary context untuk query berulang.',
    contextCompressionHint: 'Gunakan compressed context saat token rata-rata naik atau memory user besar.',
    maxTokenHint: 'Turunkan maxTokens untuk mode non-riset jika latency p90 tinggi.',
    benchmarkSamplingHint: 'Jalankan benchmark manual setelah perubahan besar, bukan setiap pesan.',
    recommendations: guards.preventOverOptimization(recommendations),
    generatedAt: guards.nowIso()
  };
}

// Section H Required Functions:
function analyzeCostEfficiency(services = {}) {
  const cost = analyzeCost(services, '0');
  return {
    estimatedTokenUsage: cost.estimatedTokenUsage.estimatedTotalTokens,
    averageTokens: cost.estimatedTokenUsage.averageTokens,
    aiPerRequest: cost.aiPerRequest,
    anomalyScore: cost.estimatedTokenUsage.spike?.spike ? 0.8 : 0.1
  };
}

function recommendCostOptimizations(services = {}) {
  return analyzeCost(services, '0').recommendations;
}

module.exports = {
  analyzeCost,
  analyzeCostEfficiency,
  recommendCostOptimizations
};

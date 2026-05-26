'use strict';

const store = require('./ops-store');
const guards = require('./ops-guards');
const telemetryCollector = require('./telemetry-collector');
const reliabilityScorer = require('./reliability-scorer');

function recommendTuning(services = {}) {
  const telemetry = telemetryCollector.getTelemetrySummary(services);
  const reliability = reliabilityScorer.calculateReliabilityScore(services, { telemetry });
  const recs = [];

  if (telemetry.recentErrorCount >= 5) {
    recs.push({
      setting: 'maxMessagesPerMinute',
      current: services.botSettings?.maxMessagesPerMinute,
      recommended: Math.max(6, Number(services.botSettings?.maxMessagesPerMinute || 15) - 3),
      reason: 'Error spike terlihat, kurangi tekanan masuk sementara.',
      confidence: 0.68
    });
  }

  if (telemetry.latency.p90 >= 7000) {
    recs.push({
      setting: 'maxTokens',
      current: 'provider default',
      recommended: 'turunkan 10-20% untuk mode non-riset',
      reason: 'Latency p90 tinggi.',
      confidence: 0.62
    });
  }

  if (telemetry.token?.averageTokens >= 1400) {
    recs.push({
      setting: 'contextPolicy',
      current: 'full selective context',
      recommended: 'summary context lebih agresif',
      reason: 'Rata-rata token tinggi.',
      confidence: 0.74
    });
  }

  if (recs.length === 0) {
    recs.push({
      setting: 'none',
      current: 'stable',
      recommended: 'pertahankan konfigurasi sekarang',
      reason: 'Tidak ada sinyal tuning kuat.',
      confidence: 0.7
    });
  }

  return {
    reliability,
    recommendations: guards.preventOverOptimization(recs),
    autoApply: false,
    reason: 'Tahap 10 hanya memberi rekomendasi tuning. Perubahan setting otomatis dihindari agar stabil.'
  };
}

function recordTuningDecision(decision = {}, services = {}) {
  const state = store.getOpsState(services);
  const item = {
    timestamp: guards.nowIso(),
    setting: guards.sanitizeText(decision.setting || 'unknown', 120),
    action: guards.sanitizeText(decision.action || 'recommendation', 120),
    confidence: Number(decision.confidence || 0.5),
    note: guards.sanitizeText(decision.note || '', 260)
  };
  store.appendBounded(state.tuningHistory, item, 40);
  store.saveOpsState(services);
  return item;
}

module.exports = {
  recommendTuning,
  recordTuningDecision
};

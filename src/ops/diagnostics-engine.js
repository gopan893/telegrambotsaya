'use strict';

const healthMonitor = require('./health-monitor');
const telemetryCollector = require('./telemetry-collector');
const guards = require('./ops-guards');

function addDiagnosis(items, type, severity, cause, fix, confidence, evidence = [], safeNextAction = '') {
  items.push({
    type,
    category: type,
    status: severity === 'info' ? 'ok' : 'attention',
    severity,
    suspectedCause: cause,
    evidence: Array.isArray(evidence) ? evidence : [evidence],
    recommendedFixes: Array.isArray(fix) ? fix : [fix],
    recommendedFix: Array.isArray(fix) ? fix[0] : fix,
    confidence,
    safeNextAction: safeNextAction || (Array.isArray(fix) ? fix[0] : fix)
  });
}

function diagnose(services = {}, input = {}) {
  const health = input.health || healthMonitor.getHealth(services);
  const telemetry = input.telemetry || telemetryCollector.getTelemetrySummary(services);
  const items = [];
  const issues = health.issues || [];

  if (issues.includes('NO_AI_PROVIDER_CONFIGURED') || issues.includes('ALL_AI_PROVIDERS_DEGRADED')) {
    addDiagnosis(items, 'model_issue', 'critical', 'Provider AI tidak tersedia atau circuit breaker terbuka.', [
      'Cek MISTRAL_API_KEY/GROQ_API_KEY di Render.',
      'Cek rate limit provider.',
      'Biarkan circuit breaker cooldown sebelum retry.'
    ], 0.86, issues, 'Gunakan fallback provider atau perbaiki env provider.');
  }

  if (issues.includes('HIGH_RAM_USAGE') || issues.includes('CRITICAL_RAM_PRESSURE')) {
    addDiagnosis(items, 'infra_issue', issues.includes('CRITICAL_RAM_PRESSURE') ? 'critical' : 'degraded', 'RAM mendekati batas Render free tier.', [
      'Kurangi context/memory yang dimasukkan ke prompt.',
      'Prune telemetry dan cache lama.',
      'Hindari benchmark berat otomatis.'
    ], 0.82, [`rss=${health.memory?.rssMb || 0}MB`], 'Jalankan /recover untuk rekomendasi pruning non-destruktif.');
  }

  if (issues.includes('QUEUE_PRESSURE') || issues.includes('QUEUE_CRITICAL')) {
    addDiagnosis(items, 'workflow_issue', issues.includes('QUEUE_CRITICAL') ? 'critical' : 'warning', 'Task queue mulai penuh.', [
      'Kurangi orchestration untuk pesan sederhana.',
      'Naikkan cooldown atau batasi concurrency.',
      'Gunakan fallback simple mode sementara.'
    ], 0.78, [`queue=${health.queue?.pending || 0}/${health.queue?.maxQueueSize || 0}`], 'Tunda benchmark dan gunakan lightweight mode sementara.');
  }

  if ((telemetry.recentErrorCount || 0) >= 5) {
    addDiagnosis(items, 'tool_issue', 'warning', 'Terjadi spike error dalam 15 menit terakhir.', [
      'Lihat /incidents untuk pola error.',
      'Cek provider/tool yang gagal paling sering.',
      'Aktifkan recovery plan non-destruktif.'
    ], 0.7, [`recentErrorCount=${telemetry.recentErrorCount || 0}`], 'Cek /incidents dan /recover.');
  }

  if (telemetry.token?.spike?.spike) {
    addDiagnosis(items, 'cost_issue', 'warning', 'Estimasi token melonjak dibanding pola terbaru.', [
      'Gunakan summary context.',
      'Kurangi maxTokens untuk mode non-riset.',
      'Aktifkan sampling telemetry dan cache.'
    ], 0.74, [`tokenSpike=${telemetry.token.spike.ratio}x`], 'Gunakan mode cost-optimization dan cek /tokens.');
  }

  if (items.length === 0) {
    addDiagnosis(items, 'healthy', 'info', 'Tidak ada gejala produksi serius pada telemetry ringan.', [
      'Lanjutkan monitoring berkala.',
      'Jalankan /benchmark setelah perubahan besar.'
    ], 0.68, ['health=ok'], 'Tidak perlu recovery.');
  }

  const worst = items.find(item => item.severity === 'critical')
    || items.find(item => item.severity === 'degraded')
    || items.find(item => item.severity === 'warning')
    || items[0];

  return {
    status: worst.status,
    diagnosis: worst.type,
    category: worst.category,
    severity: worst.severity,
    suspectedCause: worst.suspectedCause,
    evidence: worst.evidence,
    recommendedFixes: worst.recommendedFixes,
    recommendedFix: worst.recommendedFix,
    confidence: worst.confidence,
    safeNextAction: worst.safeNextAction,
    findings: items,
    generatedAt: guards.nowIso()
  };
}

function formatDiagnosis(result) {
  return [
    `Diagnosis: ${result.diagnosis}`,
    `Severity: ${result.severity}`,
    `Category: ${result.category}`,
    `Confidence: ${Number(result.confidence || 0).toFixed(2)}`,
    `Cause: ${result.suspectedCause}`,
    `Evidence: ${(result.evidence || []).join(', ') || '-'}`,
    `Safe next action: ${result.safeNextAction || '-'}`,
    '',
    'Rekomendasi:',
    ...(result.recommendedFixes || []).map(item => `- ${item}`)
  ].join('\n');
}

module.exports = {
  diagnose,
  formatDiagnosis
};

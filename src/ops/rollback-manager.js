'use strict';

const store = require('./ops-store');
const guards = require('./ops-guards');
const regressionDetector = require('./regression-detector');

function getRollbackChecklist() {
  return [
    'Catat gejala: error, latency, benchmark, provider.',
    'Cek commit terakhir dan file yang berubah.',
    'Pastikan secret/env Render tidak berubah salah.',
    'Coba recovery non-destruktif lebih dulu.',
    'Jika perlu rollback, lakukan manual tanpa force push.',
    'Setelah rollback, jalankan /benchmark dan pantau /health.'
  ];
}

function createRollbackPlan(reason = '', services = {}) {
  const state = store.getOpsState(services);
  const regression = regressionDetector.detectRegression(services);
  const plan = {
    id: `rb_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: guards.nowIso(),
    reason: guards.sanitizeText(reason || regression.recommendation, 300),
    regression,
    suspectedBadChange: 'Periksa commit terakhir yang menyentuh modul AI/ops/provider.',
    affectedMetrics: regression.findings.map(item => item.metric),
    checklist: getRollbackChecklist(),
    automaticRollback: false
  };
  store.appendBounded(state.rollbackPlans, plan, 30);
  store.saveOpsState(services);
  return plan;
}

function suggestRollback(services = {}) {
  const regression = regressionDetector.detectRegression(services);
  if (!regression.regressionDetected) {
    return {
      suggested: false,
      reason: 'Belum ada sinyal regresi kuat.',
      checklist: getRollbackChecklist()
    };
  }
  return {
    suggested: regression.severity === 'high',
    reason: regression.recommendation,
    regression,
    checklist: getRollbackChecklist()
  };
}

function recordRollback(note, services = {}) {
  const state = store.getOpsState(services);
  store.appendBounded(state.rollbackPlans, {
    id: `rb_record_${Date.now()}`,
    createdAt: guards.nowIso(),
    reason: guards.sanitizeText(note || 'manual rollback record', 300),
    recordedOnly: true,
    automaticRollback: false
  }, 30);
  store.saveOpsState(services);
}

module.exports = {
  createRollbackPlan,
  getRollbackChecklist,
  recordRollback,
  suggestRollback
};

'use strict';

const store = require('./ops-store');
const guards = require('./ops-guards');

function createExperiment(name, variants = ['control', 'variant'], services = {}) {
  const state = store.getOpsState(services);
  const uniqueVariants = variants.map(v => guards.sanitizeText(v, 80)).filter(Boolean).slice(0, 4);
  const experiment = {
    id: `ab_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: guards.sanitizeText(name || 'behavior-experiment', 120),
    status: 'draft',
    variants: uniqueVariants.length >= 2 ? uniqueVariants : ['control', 'variant'],
    assignments: {},
    metrics: [],
    createdAt: guards.nowIso(),
    updatedAt: guards.nowIso()
  };
  store.appendBounded(state.abTests, experiment, 30);
  store.saveOpsState(services);
  return experiment;
}

function getExperiment(experimentId, services = {}) {
  const state = store.getOpsState(services);
  return (state.abTests || []).find(item => item.id === experimentId) || null;
}

function assignSample(experimentId, userId, services = {}) {
  const experiment = getExperiment(experimentId, services);
  if (!experiment) return { ok: false, reason: 'experiment_not_found' };
  const id = guards.sanitizeText(userId, 80);
  if (!experiment.assignments[id]) {
    const index = Math.abs([...id].reduce((sum, ch) => sum + ch.charCodeAt(0), 0)) % experiment.variants.length;
    experiment.assignments[id] = experiment.variants[index];
    experiment.updatedAt = guards.nowIso();
    store.saveOpsState(services);
  }
  return { ok: true, variant: experiment.assignments[id], experiment };
}

function recordMetric(experimentId, variant, metric = {}, services = {}) {
  const experiment = getExperiment(experimentId, services);
  if (!experiment) return { ok: false, reason: 'experiment_not_found' };
  store.appendBounded(experiment.metrics, {
    timestamp: guards.nowIso(),
    variant: guards.sanitizeText(variant, 80),
    name: guards.sanitizeText(metric.name || 'score', 80),
    value: Number(metric.value || 0),
    note: guards.sanitizeText(metric.note || '', 160)
  }, 120);
  experiment.updatedAt = guards.nowIso();
  store.saveOpsState(services);
  return { ok: true, experiment };
}

function compareExperiment(experimentId, services = {}) {
  const experiment = getExperiment(experimentId, services);
  if (!experiment) return { ok: false, reason: 'experiment_not_found' };
  const byVariant = {};
  for (const metric of experiment.metrics || []) {
    const variant = metric.variant || 'unknown';
    if (!byVariant[variant]) byVariant[variant] = { count: 0, total: 0 };
    byVariant[variant].count += 1;
    byVariant[variant].total += Number(metric.value || 0);
  }
  const summary = Object.entries(byVariant).map(([variant, data]) => ({
    variant,
    count: data.count,
    average: data.count ? Number((data.total / data.count).toFixed(3)) : 0
  })).sort((a, b) => b.average - a.average);
  const winner = summary[0];
  return {
    ok: true,
    experiment,
    summary,
    recommendation: winner && winner.count >= 3
      ? `Pertimbangkan ${winner.variant}, tetapi jangan promote tanpa cek safety dan regresi.`
      : 'Sample belum cukup; lanjutkan observasi.'
  };
}

function listExperiments(services = {}, limit = 10) {
  const state = store.getOpsState(services);
  return (state.abTests || []).slice(-limit).reverse();
}

module.exports = {
  createExperiment,
  assignSample,
  recordMetric,
  compareExperiment,
  listExperiments
};

'use strict';

const store = require('./model-strategy-store');
const utils = require('./model-strategy-utils');

function evaluateModelQuality(modelResult = {}, task = {}, services = {}) {
  const text = String(modelResult.text || modelResult.output || modelResult.summary || '');
  const taskType = task.class || task.taskType || 'simple_chat';
  const accuracy = evaluateAccuracy(text, task);
  const completeness = evaluateCompleteness(text, task);
  const relevance = evaluateRelevance(text, taskType);
  const safety = evaluateSafety(text);
  const overall = +((accuracy * 0.3 + completeness * 0.25 + relevance * 0.25 + safety * 0.2)).toFixed(2);
  return {
    id: utils.createId('qual'),
    model: modelResult.model || 'unknown',
    taskType,
    overall,
    accuracy,
    completeness,
    relevance,
    safety,
    textLength: text.length,
    evaluatedAt: new Date().toISOString()
  };
}

function evaluateAccuracy(text = '', task = {}) {
  if (!text) return 0.1;
  if (/\b(error|failed|cannot|unable|uncertain)\b/i.test(text)) return 0.3;
  if (/\b(confident|verified|confirmed)\b/i.test(text)) return 0.9;
  if (text.length > 150) return 0.7;
  return 0.5;
}

function evaluateCompleteness(text = '', task = {}) {
  const expected = task.expectedOutput || '';
  if (!text) return 0.1;
  if (expected && text.toLowerCase().includes(expected.toLowerCase().slice(0, 30))) return 1.0;
  if (text.length > 200) return 0.8;
  if (text.length > 80) return 0.6;
  return 0.4;
}

function evaluateRelevance(text = '', taskType = '') {
  if (!text || !taskType) return 0.5;
  const clean = taskType.replace(/_/g, ' ');
  if (text.toLowerCase().includes(clean.toLowerCase().slice(0, 8))) return 0.9;
  if (text.length > 50) return 0.6;
  return 0.4;
}

function evaluateSafety(text = '') {
  if (/secret|token|password|api.?key|credential/i.test(text)) return 0.2;
  if (/\b(harmful|dangerous|malicious|exploit)\b/i.test(text)) return 0.3;
  return 0.9;
}

async function recordQualityEvaluation(evaluation, services = {}) {
  return store.addRecord('qualityEvaluations', evaluation, services);
}

async function getModelQualitySummary(model = '', services = {}) {
  const records = await store.getRecords('qualityEvaluations', r => r.model === model, services);
  if (!records.length) return { model, count: 0, avgOverall: 0, avgSafety: 0 };
  const totals = records.reduce((acc, r) => ({
    overall: acc.overall + (r.overall || 0),
    safety: acc.safety + (r.safety || 0)
  }), { overall: 0, safety: 0 });
  return {
    model,
    count: records.length,
    avgOverall: +(totals.overall / records.length).toFixed(2),
    avgSafety: +(totals.safety / records.length).toFixed(2)
  };
}

module.exports = { evaluateModelQuality, evaluateAccuracy, evaluateCompleteness, evaluateRelevance, evaluateSafety, recordQualityEvaluation, getModelQualitySummary };

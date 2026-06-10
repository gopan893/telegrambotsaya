'use strict';

const utils = require('./agent-runtime-utils');

function scoreResponseQuality(response = {}, task = {}, services = {}) {
  const completeness = scoreCompleteness(response, task);
  const accuracy = scoreAccuracy(response, task);
  const safety = scoreSafety(response, task);
  const relevance = scoreRelevance(response, task);
  const clarity = scoreClarity(response);
  const overall = +(completeness * 0.25 + accuracy * 0.25 + safety * 0.20 + relevance * 0.15 + clarity * 0.15).toFixed(2);
  return {
    id: utils.createId('qs'),
    taskId: task.id || 'unknown',
    overall,
    completeness,
    accuracy,
    safety,
    relevance,
    clarity,
    scoredAt: new Date().toISOString()
  };
}

function scoreCompleteness(response = {}, task = {}) {
  const summary = String(response.summary || response.result || '');
  const expected = String(task.expectedOutput || '');
  if (!summary) return 0.1;
  if (expected && summary.toLowerCase().includes(expected.toLowerCase().slice(0, 30))) return 1.0;
  if (summary.length > 200) return 0.8;
  if (summary.length > 80) return 0.6;
  return 0.4;
}

function scoreAccuracy(response = {}, task = {}) {
  const text = String(response.summary || response.result || '');
  if (/\b(error|failed|cannot|unable|not sure|unsure|might be wrong)\b/i.test(text)) return 0.4;
  if (/\b(confident|verified|confirmed|correct|accurate)\b/i.test(text)) return 0.9;
  if (response.confidence) return Math.min(1, Math.max(0, response.confidence));
  if (text.length > 100) return 0.7;
  return 0.5;
}

function scoreSafety(response = {}, task = {}) {
  const text = JSON.stringify(response);
  if (/secret|token|password|api.?key|credential|private.*key/i.test(text)) return 0.2;
  if (response.proposalRecommendation) return 0.95;
  if (response.hiddenReasoningRemoved) return 0.9;
  return 0.8;
}

function scoreRelevance(response = {}, task = {}) {
  const text = String(response.summary || response.result || '');
  const taskType = String(task.type || task.class || '');
  if (!text) return 0.2;
  if (taskType && text.toLowerCase().includes(taskType.toLowerCase().slice(0, 10))) return 0.9;
  if (text.length > 50) return 0.6;
  return 0.4;
}

function scoreClarity(response = {}) {
  const text = String(response.summary || response.result || '');
  if (!text) return 0.1;
  const sentences = text.split(/[.!?]+/).filter(s => s.trim());
  if (sentences.length >= 2 && text.length > 60) return 0.85;
  if (text.length > 30) return 0.6;
  return 0.4;
}

function aggregateQualityScores(scores = []) {
  if (!scores.length) return { count: 0, avgOverall: 0, avgSafety: 0, minOverall: 0 };
  const totals = scores.reduce((acc, s) => ({
    overall: acc.overall + (s.overall || 0),
    safety: acc.safety + (s.safety || 0),
    completeness: acc.completeness + (s.completeness || 0)
  }), { overall: 0, safety: 0, completeness: 0 });
  return {
    count: scores.length,
    avgOverall: +(totals.overall / scores.length).toFixed(2),
    avgSafety: +(totals.safety / scores.length).toFixed(2),
    avgCompleteness: +(totals.completeness / scores.length).toFixed(2),
    minOverall: +Math.min(...scores.map(s => s.overall || 0)).toFixed(2)
  };
}

module.exports = { scoreResponseQuality, scoreCompleteness, scoreAccuracy, scoreSafety, scoreRelevance, scoreClarity, aggregateQualityScores };

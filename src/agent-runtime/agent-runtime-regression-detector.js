'use strict';

const store = require('./agent-runtime-store');
const utils = require('./agent-runtime-utils');

function detectRegression(baseline = {}, current = {}, services = {}) {
  const regressions = [];
  const latencyThreshold = services.latencyRegressionThreshold || 1.5;
  const costThreshold = services.costRegressionThreshold || 2.0;
  const qualityThreshold = services.qualityRegressionThreshold || 0.7;
  if (baseline.avgLatency > 0 && current.avgLatency > baseline.avgLatency * latencyThreshold) {
    regressions.push({ type: 'latency', baseline: baseline.avgLatency, current: current.avgLatency, factor: +(current.avgLatency / baseline.avgLatency).toFixed(2) });
  }
  if (baseline.avgCost > 0 && current.avgCost > baseline.avgCost * costThreshold) {
    regressions.push({ type: 'cost', baseline: baseline.avgCost, current: current.avgCost, factor: +(current.avgCost / baseline.avgCost).toFixed(2) });
  }
  if (baseline.avgQuality > 0 && current.avgQuality < baseline.avgQuality * qualityThreshold) {
    regressions.push({ type: 'quality', baseline: baseline.avgQuality, current: current.avgQuality, factor: +(current.avgQuality / baseline.avgQuality).toFixed(2) });
  }
  if (baseline.successRate > 0 && current.successRate < baseline.successRate * 0.8) {
    regressions.push({ type: 'success_rate', baseline: baseline.successRate, current: current.successRate });
  }
  return {
    id: utils.createId('reg'),
    hasRegression: regressions.length > 0,
    regressions,
    severity: regressions.length >= 3 ? 'high' : regressions.length >= 1 ? 'medium' : 'none',
    detectedAt: new Date().toISOString()
  };
}

function comparePeriods(profiles = [], periodMs = 60 * 60 * 1000, services = {}) {
  const now = Date.now();
  const recent = profiles.filter(p => now - new Date(p.recordedAt || 0).getTime() < periodMs);
  const older = profiles.filter(p => {
    const age = now - new Date(p.recordedAt || 0).getTime();
    return age >= periodMs && age < periodMs * 2;
  });
  const summarize = (arr) => {
    if (!arr.length) return { count: 0, avgLatency: 0, avgCost: 0, avgQuality: 0, successRate: 0 };
    const avgLatency = arr.reduce((s, p) => s + (p.latencyMs || 0), 0) / arr.length;
    const avgCost = arr.reduce((s, p) => s + (p.costEstimate || 0), 0) / arr.length;
    const qualities = arr.filter(p => p.qualityScore != null);
    const avgQuality = qualities.length ? qualities.reduce((s, p) => s + p.qualityScore, 0) / qualities.length : 0;
    const successRate = arr.filter(p => p.success).length / arr.length;
    return { count: arr.length, avgLatency: Math.round(avgLatency), avgCost: +avgCost.toFixed(6), avgQuality: +avgQuality.toFixed(2), successRate: +successRate.toFixed(2) };
  };
  const baseline = summarize(older);
  const current = summarize(recent);
  return { baseline, current, regression: detectRegression(baseline, current, services) };
}

async function recordRegression(regression, services = {}) {
  return store.addRecord('regressions', regression, services);
}

async function getRecentRegressions(limit = 20, services = {}) {
  const all = await store.getRecords('regressions', null, services);
  return all.filter(r => r.hasRegression).slice(-limit);
}

module.exports = { detectRegression, comparePeriods, recordRegression, getRecentRegressions };

'use strict';

const store = require('./ops-store');
const guards = require('./ops-guards');

function estimateTokens(text = '') {
  if (!text) return 0;
  // Dynamic estimate: 1 token is roughly 4 characters
  return Math.max(1, Math.round(String(text).length / 4));
}

function recordTokenEstimate(scope, inputText, outputText, services = {}) {
  const promptTokens = estimateTokens(inputText);
  const completionTokens = estimateTokens(outputText);
  const totalTokens = promptTokens + completionTokens;
  const state = store.getOpsState(services);
  
  store.appendBounded(state.telemetry.tokenSamples, {
    timestamp: guards.nowIso(),
    kind: 'estimate',
    scope: guards.sanitizeText(scope || 'unknown', 80),
    promptTokens,
    completionTokens,
    totalTokens
  }, state.config.maxTokenSamples || 160);
  
  store.saveOpsState(services);
  return totalTokens;
}

function summarizeTokenUsage(services = {}) {
  const state = store.getOpsState(services);
  const samples = state.telemetry.tokenSamples || [];
  const total = samples.reduce((sum, item) => sum + Number(item.totalTokens || 0), 0);
  const prompt = samples.reduce((sum, item) => sum + Number(item.promptTokens || 0), 0);
  const comp = samples.reduce((sum, item) => sum + Number(item.completionTokens || 0), 0);
  const avg = samples.length ? Math.round(total / samples.length) : 0;
  
  const providers = {};
  for (const item of samples) {
    const key = item.provider || item.scope || 'unknown';
    providers[key] = (providers[key] || 0) + (item.totalTokens || 0);
  }
  
  const sorted = [...samples].sort((a, b) => (b.totalTokens || 0) - (a.totalTokens || 0));
  const expensive = sorted[0]
    ? { provider: sorted[0].provider || 'unknown', model: sorted[0].model || 'unknown', totalTokens: sorted[0].totalTokens }
    : null;
  const spike = guards.detectTokenSpike(samples);

  return {
    sampleCount: samples.length,
    estimatedTotalTokens: total,
    estimatedPromptTokens: prompt,
    estimatedCompletionTokens: comp,
    averageTokens: avg,
    spike,
    topExpensiveOperation: expensive,
    byProvider: providers,
    generatedAt: guards.nowIso()
  };
}

function detectTokenSpike(services = {}) {
  const state = store.getOpsState(services);
  return guards.detectTokenSpike(state.telemetry.tokenSamples || []);
}

function getTokenSummary(services = {}) {
  return summarizeTokenUsage(services);
}

module.exports = {
  estimateTokens,
  recordTokenEstimate,
  summarizeTokenUsage,
  detectTokenSpike,
  getTokenSummary
};

'use strict';

const store = require('./ops-store');
const guards = require('./ops-guards');

function estimateTokens(text) {
  const s = String(text || '');
  if (!s) return 0;
  const ascii = s.replace(/[^\x00-\x7F]/g, '');
  const nonAscii = s.length - ascii.length;
  return Math.max(1, Math.ceil(ascii.length / 4 + nonAscii / 1.8));
}

function recordPromptSize(text, services = {}, meta = {}) {
  return recordTokenSample({
    kind: 'prompt',
    promptTokens: estimateTokens(text),
    completionTokens: 0,
    ...meta
  }, services);
}

function recordCompletionSize(text, services = {}, meta = {}) {
  return recordTokenSample({
    kind: 'completion',
    promptTokens: 0,
    completionTokens: estimateTokens(text),
    ...meta
  }, services);
}

function recordTokenSample(sample = {}, services = {}) {
  const state = store.getOpsState(services);
  const promptTokens = Math.max(0, Number(sample.promptTokens || 0));
  const completionTokens = Math.max(0, Number(sample.completionTokens || 0));
  const item = {
    timestamp: guards.nowIso(),
    kind: sample.kind || 'ai',
    provider: guards.sanitizeText(sample.provider || 'unknown', 80),
    model: guards.sanitizeText(sample.model || 'unknown', 120),
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    cached: Boolean(sample.cached)
  };
  store.appendBounded(state.telemetry.tokenSamples, item, state.config.maxTokenSamples);
  store.compactState(state);
  store.saveOpsState(services);
  return item;
}

function summarizeTokenUsage(services = {}) {
  const state = store.getOpsState(services);
  const samples = state.telemetry.tokenSamples || [];
  const recent = samples.slice(-50);
  const total = recent.reduce((sum, item) => sum + Number(item.totalTokens || 0), 0);
  const prompt = recent.reduce((sum, item) => sum + Number(item.promptTokens || 0), 0);
  const completion = recent.reduce((sum, item) => sum + Number(item.completionTokens || 0), 0);
  const byProvider = {};
  let topExpensiveOperation = null;
  for (const item of recent) {
    const key = item.provider || 'unknown';
    byProvider[key] = (byProvider[key] || 0) + Number(item.totalTokens || 0);
    if (!topExpensiveOperation || Number(item.totalTokens || 0) > Number(topExpensiveOperation.totalTokens || 0)) {
      topExpensiveOperation = {
        provider: item.provider || 'unknown',
        model: item.model || 'unknown',
        kind: item.kind || 'ai',
        totalTokens: Number(item.totalTokens || 0),
        promptTokens: Number(item.promptTokens || 0),
        completionTokens: Number(item.completionTokens || 0),
        timestamp: item.timestamp
      };
    }
  }
  return {
    sampleCount: recent.length,
    estimatedTotalTokens: total,
    estimatedPromptTokens: prompt,
    estimatedCompletionTokens: completion,
    averageTokens: recent.length ? Math.round(total / recent.length) : 0,
    byProvider,
    topExpensiveOperation,
    spike: guards.detectTokenSpike(samples)
  };
}

function detectTokenSpike(services = {}) {
  const state = store.getOpsState(services);
  return guards.detectTokenSpike(state.telemetry.tokenSamples || []);
}

module.exports = {
  estimateTokens,
  recordPromptSize,
  recordCompletionSize,
  recordTokenSample,
  summarizeTokenUsage,
  detectTokenSpike
};

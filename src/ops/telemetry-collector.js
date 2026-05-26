'use strict';

const store = require('./ops-store');
const guards = require('./ops-guards');
const tokenAnalyzer = require('./token-analyzer');

function inc(obj, key, amount = 1) {
  obj[key] = Number(obj[key] || 0) + amount;
}

function recordEvent(event = {}, services = {}) {
  const state = store.getOpsState(services);
  const counters = state.telemetry.counters;
  const type = guards.sanitizeText(event.type || 'event', 80);
  const countBefore = Number(counters[type] || 0);
  inc(counters, type);

  if (guards.shouldSample(countBefore, state.config.telemetrySamplingRate)) {
    store.appendBounded(state.telemetry.events, {
      timestamp: guards.nowIso(),
      type,
      name: guards.sanitizeText(event.name || type, 120),
      component: guards.sanitizeText(event.component || 'bot', 80),
      status: guards.sanitizeText(event.status || 'ok', 40),
      latencyMs: Math.max(0, Number(event.latencyMs || 0)),
      meta: guards.sanitizeMeta(event.meta || {})
    }, state.config.maxEvents);
  }

  store.compactState(state);
  store.saveOpsState(services);
  return true;
}

function recordRequest(payload = {}, services = {}) {
  recordEvent({
    type: 'request',
    name: payload.name || 'telegram_update',
    component: 'webhook',
    status: payload.status || 'received',
    latencyMs: payload.latencyMs,
    meta: {
      hasText: Boolean(payload.hasText),
      hasAttachment: Boolean(payload.hasAttachment)
    }
  }, services);
}

function recordCommand(command, userId, services = {}) {
  const state = store.getOpsState(services);
  const clean = guards.sanitizeText(command || 'unknown', 80);
  inc(state.telemetry.commandUsage, clean);
  recordEvent({
    type: 'command',
    name: clean,
    component: 'telegram',
    meta: { userId: userId ? guards.sanitizeText(userId, 40) : undefined }
  }, services);
}

function recordAIUsage(payload = {}, services = {}) {
  const state = store.getOpsState(services);
  const provider = guards.sanitizeText(payload.provider || 'unknown', 80);
  const model = guards.sanitizeText(payload.model || provider, 120);
  const promptTokens = Math.max(0, Number(payload.promptTokens || 0));
  const completionTokens = Math.max(0, Number(payload.completionTokens || 0));
  const latencyMs = Math.max(0, Number(payload.latencyMs || 0));
  inc(state.telemetry.counters, 'aiCall');
  if (!state.telemetry.modelUsage[provider]) {
    state.telemetry.modelUsage[provider] = { calls: 0, success: 0, failure: 0, cached: 0, estimatedTokens: 0 };
  }
  const usage = state.telemetry.modelUsage[provider];
  usage.calls += 1;
  usage.success += payload.success === false ? 0 : 1;
  usage.failure += payload.success === false ? 1 : 0;
  usage.cached += payload.cached ? 1 : 0;
  usage.estimatedTokens += promptTokens + completionTokens;

  store.appendBounded(state.telemetry.tokenSamples, {
    timestamp: guards.nowIso(),
    kind: 'ai',
    provider,
    model,
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    cached: Boolean(payload.cached)
  }, state.config.maxTokenSamples);
  if (latencyMs) {
    store.appendBounded(state.telemetry.latencySamples, {
      timestamp: guards.nowIso(),
      scope: `ai:${provider}`,
      latencyMs: Math.round(latencyMs),
      meta: { model }
    }, state.config.maxLatencySamples);
  }
  store.appendBounded(state.telemetry.events, {
    timestamp: guards.nowIso(),
    type: 'aiCall',
    name: provider,
    component: 'ai-provider',
    status: payload.success === false ? 'failed' : 'ok',
    latencyMs: Math.round(latencyMs),
    meta: {
      model,
      cached: Boolean(payload.cached),
      error: payload.error ? guards.sanitizeText(payload.error, 160) : undefined
    }
  }, state.config.maxEvents);
  store.compactState(state);
  store.saveOpsState(services);
}

function recordToolUsage(payload = {}, services = {}) {
  const state = store.getOpsState(services);
  const tool = guards.sanitizeText(payload.tool || payload.name || 'unknown', 80);
  const latencyMs = Math.max(0, Number(payload.latencyMs || 0));
  inc(state.telemetry.counters, 'toolExecution');
  if (!state.telemetry.toolUsage[tool]) {
    state.telemetry.toolUsage[tool] = { calls: 0, success: 0, failure: 0, latencyTotalMs: 0 };
  }
  const usage = state.telemetry.toolUsage[tool];
  usage.calls += 1;
  usage.success += payload.success === false ? 0 : 1;
  usage.failure += payload.success === false ? 1 : 0;
  usage.latencyTotalMs += latencyMs;
  if (latencyMs) {
    store.appendBounded(state.telemetry.latencySamples, {
      timestamp: guards.nowIso(),
      scope: `tool:${tool}`,
      latencyMs: Math.round(latencyMs),
      meta: {}
    }, state.config.maxLatencySamples);
  }
  store.appendBounded(state.telemetry.events, {
    timestamp: guards.nowIso(),
    type: 'toolExecution',
    name: tool,
    component: 'tool',
    status: payload.success === false ? 'failed' : 'ok',
    latencyMs: Math.round(latencyMs),
    meta: payload.meta || {}
  }, state.config.maxEvents);
  store.compactState(state);
  store.saveOpsState(services);
}

function recordError(error, services = {}, meta = {}) {
  const state = store.getOpsState(services);
  inc(state.telemetry.counters, 'error');
  const item = {
    ...guards.safeError(error, meta.scope || 'unknown'),
    severity: guards.sanitizeText(meta.severity || 'warning', 40),
    component: guards.sanitizeText(meta.component || meta.scope || 'unknown', 80)
  };
  store.appendBounded(state.telemetry.recentErrors, item, state.config.maxErrors);
  recordEvent({
    type: 'error',
    name: item.component,
    component: item.component,
    status: item.severity,
    meta: { message: item.message }
  }, services);
}

function recordLatency(scope, latencyMs, services = {}, meta = {}) {
  const state = store.getOpsState(services);
  const ms = Math.max(0, Number(latencyMs || 0));
  if (!ms) return;
  store.appendBounded(state.telemetry.latencySamples, {
    timestamp: guards.nowIso(),
    scope: guards.sanitizeText(scope || 'unknown', 100),
    latencyMs: Math.round(ms),
    meta: guards.sanitizeMeta(meta)
  }, state.config.maxLatencySamples);
  store.compactState(state);
  store.saveOpsState(services);
}

function getTelemetrySummary(services = {}) {
  const state = store.getOpsState(services);
  const latencies = state.telemetry.latencySamples || [];
  const sorted = latencies.map(item => Number(item.latencyMs || 0)).sort((a, b) => a - b);
  const p = (q) => {
    if (!sorted.length) return 0;
    const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * q));
    return sorted[idx];
  };
  const recentErrors = guards.getRecent(state.telemetry.recentErrors || [], 15 * 60 * 1000);
  return {
    counters: { ...state.telemetry.counters },
    commandUsage: { ...state.telemetry.commandUsage },
    modelUsage: { ...state.telemetry.modelUsage },
    toolUsage: { ...state.telemetry.toolUsage },
    latency: {
      samples: latencies.length,
      p50: p(0.5),
      p90: p(0.9),
      p95: p(0.95),
      max: sorted[sorted.length - 1] || 0
    },
    recentErrorCount: recentErrors.length,
    token: tokenAnalyzer.summarizeTokenUsage(services),
    generatedAt: guards.nowIso()
  };
}

function pruneTelemetry(services = {}) {
  const state = store.getOpsState(services);
  store.compactState(state);
  store.saveOpsState(services);
  return getTelemetrySummary(services);
}

module.exports = {
  recordEvent,
  recordRequest,
  recordCommand,
  recordAIUsage,
  recordToolUsage,
  recordError,
  recordLatency,
  getTelemetrySummary,
  pruneTelemetry
};

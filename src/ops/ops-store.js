'use strict';

const OPS_USER_ID = '__ops__';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function nowIso() {
  return new Date().toISOString();
}

function defaultState() {
  return {
    version: 1,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    telemetry: {
      counters: {
        request: 0,
        command: 0,
        aiCall: 0,
        toolExecution: 0,
        error: 0,
        memoryAccess: 0,
        workflowExecution: 0
      },
      modelUsage: {},
      commandUsage: {},
      toolUsage: {},
      latencySamples: [],
      tokenSamples: [],
      events: [],
      recentErrors: []
    },
    profiler: {
      operations: []
    },
    incidents: [],
    benchmarkRuns: [],
    rollbackPlans: [],
    tuningHistory: [],
    canaries: [],
    evaluations: [],
    opsLessons: [],
    recoveryHistory: [],
    providerState: {},
    scheduler: {
      lastEvaluationAt: null,
      intervalMs: 6 * 60 * 60 * 1000,
      enabled: false
    },
    config: {
      telemetrySamplingRate: 1,
      maxEvents: 250,
      maxLatencySamples: 160,
      maxTokenSamples: 160,
      maxErrors: 80,
      maxIncidents: 80,
      maxBenchmarkRuns: 40,
      maxLessons: 80
    }
  };
}

let fallbackState = defaultState();

function ensureShape(state) {
  const base = defaultState();
  const merged = {
    ...base,
    ...(state && typeof state === 'object' ? state : {})
  };

  merged.telemetry = {
    ...base.telemetry,
    ...(merged.telemetry || {})
  };
  merged.telemetry.counters = {
    ...base.telemetry.counters,
    ...(merged.telemetry.counters || {})
  };
  merged.profiler = {
    ...base.profiler,
    ...(merged.profiler || {})
  };
  merged.scheduler = {
    ...base.scheduler,
    ...(merged.scheduler || {})
  };
  merged.config = {
    ...base.config,
    ...(merged.config || {})
  };

  for (const key of [
    'latencySamples',
    'tokenSamples',
    'events',
    'recentErrors'
  ]) {
    if (!Array.isArray(merged.telemetry[key])) merged.telemetry[key] = [];
  }

  for (const key of [
    'operations',
    'incidents',
    'benchmarkRuns',
    'rollbackPlans',
    'tuningHistory',
    'canaries',
    'evaluations',
    'opsLessons',
    'recoveryHistory'
  ]) {
    if (key === 'operations') {
      if (!Array.isArray(merged.profiler.operations)) merged.profiler.operations = [];
    } else if (!Array.isArray(merged[key])) {
      merged[key] = [];
    }
  }

  if (!merged.telemetry.modelUsage || typeof merged.telemetry.modelUsage !== 'object') merged.telemetry.modelUsage = {};
  if (!merged.telemetry.commandUsage || typeof merged.telemetry.commandUsage !== 'object') merged.telemetry.commandUsage = {};
  if (!merged.telemetry.toolUsage || typeof merged.telemetry.toolUsage !== 'object') merged.telemetry.toolUsage = {};
  if (!merged.providerState || typeof merged.providerState !== 'object') merged.providerState = {};
  merged.updatedAt = nowIso();

  return merged;
}

function getOpsState(services = {}) {
  if (typeof services.ensureUser !== 'function') {
    fallbackState = ensureShape(fallbackState);
    return fallbackState;
  }

  const bucket = services.ensureUser(OPS_USER_ID);
  if (!bucket.ops || typeof bucket.ops !== 'object') {
    bucket.ops = defaultState();
  }
  bucket.ops = ensureShape(bucket.ops);
  return bucket.ops;
}

function saveOpsState(services = {}) {
  try {
    if (typeof services.persist === 'function') {
      const result = services.persist();
      if (result && typeof result.catch === 'function') {
        result.catch(() => {});
      }
    }
  } catch (_) {}
}

function resetOpsState(services = {}) {
  const next = defaultState();
  if (typeof services.ensureUser !== 'function') {
    fallbackState = next;
    return next;
  }
  const bucket = services.ensureUser(OPS_USER_ID);
  bucket.ops = next;
  saveOpsState(services);
  return bucket.ops;
}

function appendBounded(list, item, max = 100) {
  const arr = Array.isArray(list) ? list : [];
  arr.push(item);
  while (arr.length > max) arr.shift();
  return arr;
}

function compactState(state) {
  const cfg = state.config || {};
  const telemetry = state.telemetry || {};
  telemetry.events = (telemetry.events || []).slice(-(cfg.maxEvents || 250));
  telemetry.latencySamples = (telemetry.latencySamples || []).slice(-(cfg.maxLatencySamples || 160));
  telemetry.tokenSamples = (telemetry.tokenSamples || []).slice(-(cfg.maxTokenSamples || 160));
  telemetry.recentErrors = (telemetry.recentErrors || []).slice(-(cfg.maxErrors || 80));
  state.incidents = (state.incidents || []).slice(-(cfg.maxIncidents || 80));
  state.benchmarkRuns = (state.benchmarkRuns || []).slice(-(cfg.maxBenchmarkRuns || 40));
  state.opsLessons = (state.opsLessons || []).slice(-(cfg.maxLessons || 80));
  state.profiler.operations = (state.profiler.operations || []).slice(-160);
  state.rollbackPlans = (state.rollbackPlans || []).slice(-30);
  state.tuningHistory = (state.tuningHistory || []).slice(-40);
  state.canaries = (state.canaries || []).slice(-30);
  state.evaluations = (state.evaluations || []).slice(-40);
  state.recoveryHistory = (state.recoveryHistory || []).slice(-50);
  state.updatedAt = nowIso();
  return state;
}

module.exports = {
  OPS_USER_ID,
  defaultState,
  getOpsState,
  saveOpsState,
  resetOpsState,
  appendBounded,
  compactState,
  clone
};

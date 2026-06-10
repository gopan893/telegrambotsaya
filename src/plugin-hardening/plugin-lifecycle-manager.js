'use strict';

const STATES = ['discovered', 'installed', 'enabled', 'disabled', 'degraded', 'blocked', 'deprecated', 'failed', 'unknown'];
const VALID_TRANSITIONS = {
  discovered: ['installed', 'failed', 'blocked'],
  installed: ['enabled', 'disabled', 'failed', 'blocked', 'deprecated'],
  enabled: ['disabled', 'degraded', 'failed', 'blocked', 'deprecated'],
  disabled: ['enabled', 'failed', 'blocked', 'deprecated'],
  degraded: ['enabled', 'disabled', 'failed', 'blocked', 'deprecated'],
  blocked: ['disabled', 'failed'],
  deprecated: ['disabled', 'failed'],
  failed: ['discovered', 'installed', 'blocked'],
  unknown: ['discovered', 'failed', 'blocked']
};

function createLifecycleEntry(pluginId, initialState) {
  const state = STATES.includes(initialState) ? initialState : 'discovered';
  return {
    pluginId,
    state,
    previousState: null,
    enabled: state === 'enabled',
    transitions: [{ from: null, to: state, at: new Date().toISOString(), reason: 'initial' }],
    errorLog: [],
    metadata: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

function canTransition(fromState, toState) {
  if (!VALID_TRANSITIONS[fromState]) return false;
  return VALID_TRANSITIONS[fromState].includes(toState);
}

function transitionLifecycle(entry, toState, reason) {
  if (!entry) return { ok: false, error: 'No lifecycle entry' };
  if (!STATES.includes(toState)) return { ok: false, error: 'Invalid target state: ' + toState };
  if (!canTransition(entry.state, toState)) {
    return { ok: false, error: 'Cannot transition from ' + entry.state + ' to ' + toState };
  }
  const from = entry.state;
  entry.previousState = from;
  entry.state = toState;
  entry.enabled = toState === 'enabled';
  entry.transitions.push({ from, to: toState, at: new Date().toISOString(), reason: reason || 'manual' });
  entry.updatedAt = new Date().toISOString();
  return entry;
}

function recordError(entry, error) {
  if (!entry) return entry;
  entry.errorLog.push({ error: String(error), at: new Date().toISOString() });
  entry.updatedAt = new Date().toISOString();
  return entry;
}

function forceTransition(entry, toState, reason) {
  if (!entry) return { ok: false, error: 'No lifecycle entry' };
  if (!STATES.includes(toState)) return { ok: false, error: 'Invalid target state: ' + toState };
  const from = entry.state;
  entry.previousState = from;
  entry.state = toState;
  entry.enabled = toState === 'enabled';
  entry.transitions.push({ from, to: toState, at: new Date().toISOString(), reason: reason || 'force' });
  entry.updatedAt = new Date().toISOString();
  return { ok: true, entry };
}

function getLifecycleHistory(entry) {
  if (!entry) return [];
  return entry.transitions || [];
}

function isTerminalState(state) {
  return state === 'failed' || state === 'blocked';
}

function getActiveLifecycleEntries(entries) {
  if (!Array.isArray(entries)) return [];
  return entries.filter(e => !isTerminalState(e.state));
}

function getLifecycleStats(entries) {
  if (!Array.isArray(entries)) return {};
  const stats = {};
  for (const s of STATES) {
    stats[s] = entries.filter(e => e.state === s).length;
  }
  stats.total = entries.length;
  stats.active = entries.filter(e => !isTerminalState(e.state)).length;
  stats.terminal = entries.filter(e => isTerminalState(e.state)).length;
  return stats;
}

module.exports = {
  createLifecycleEntry, canTransition, transitionLifecycle,
  recordError, forceTransition, getLifecycleHistory,
  isTerminalState, getActiveLifecycleEntries, getLifecycleStats,
  STATES, VALID_TRANSITIONS
};

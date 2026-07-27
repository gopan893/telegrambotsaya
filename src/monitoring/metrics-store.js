'use strict';

function createMetricsStore() {
  const metrics = {};

  function set(key, value) { metrics[key] = { value, updatedAt: new Date().toISOString() }; }
  function get(key) { return metrics[key] || null; }
  function getAll() { return { ...metrics }; }
  function increment(key, by) {
    const existing = metrics[key];
    metrics[key] = { value: (existing?.value || 0) + (by || 1), updatedAt: new Date().toISOString() };
  }
  function snapshot() {
    const s = {};
    for (const [k, v] of Object.entries(metrics)) s[k] = v.value;
    return s;
  }

  return { set, get, getAll, increment, snapshot };
}

module.exports = { createMetricsStore };

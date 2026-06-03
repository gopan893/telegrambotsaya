'use strict';

const sanitizer = require('./connector-result-sanitizer');

const INTEGRATION_EXECUTIONS_KEY = 'integration_executions';
const INTEGRATION_EXECUTION_RESULTS_KEY = 'integration_execution_results';
const INTEGRATION_QUALITY_GATE_RUNS_KEY = 'integration_quality_gate_runs';
const INTEGRATION_EVALUATION_GATE_RESULTS_KEY = 'integration_evaluation_gate_results';
const INTEGRATION_PROPOSAL_PIPELINE_RUNS_KEY = 'integration_proposal_pipeline_runs';

function nowIso() {
  return new Date().toISOString();
}

function createId(prefix = 'integration') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function memoryBucket(services = {}) {
  if (!services.__integrationStore) services.__integrationStore = {};
  return services.__integrationStore;
}

async function loadIntegrationData(key, fallback = [], services = {}) {
  try {
    if (services.storageManager?.safeRead) {
      const value = await services.storageManager.safeRead(key, fallback);
      return Array.isArray(fallback) ? (Array.isArray(value) ? value : fallback) : (value || fallback);
    }
  } catch (_) {}
  const mem = memoryBucket(services);
  if (typeof mem[key] === 'undefined') mem[key] = fallback;
  return mem[key];
}

async function saveIntegrationData(key, data, services = {}) {
  const safe = sanitizer.sanitizeConnectorResult(data);
  try {
    if (services.storageManager?.safeWrite) {
      await services.storageManager.safeWrite(key, safe);
      return safe;
    }
  } catch (_) {}
  memoryBucket(services)[key] = safe;
  return safe;
}

function matches(item = {}, filters = {}) {
  for (const [key, value] of Object.entries(filters || {})) {
    if (['limit'].includes(key)) continue;
    if (value === undefined || value === null || value === '' || value === 'all') continue;
    if (String(item[key] || '') !== String(value)) return false;
  }
  return true;
}

async function listIntegrationItems(key, filters = {}, services = {}) {
  const list = await loadIntegrationData(key, [], services);
  const limit = Math.min(Math.max(Number(filters.limit || 50), 1), 200);
  return (Array.isArray(list) ? list : [])
    .filter(item => matches(item, filters))
    .sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')))
    .slice(0, limit);
}

async function getIntegrationItem(key, id, services = {}) {
  const list = await loadIntegrationData(key, [], services);
  return (Array.isArray(list) ? list : []).find(item => String(item.id) === String(id)) || null;
}

async function upsertIntegrationItem(key, item, services = {}) {
  const list = await loadIntegrationData(key, [], services);
  const next = Array.isArray(list) ? list.slice() : [];
  const safe = sanitizer.sanitizeConnectorResult({
    ...item,
    updatedAt: item.updatedAt || nowIso()
  });
  const index = next.findIndex(existing => existing.id === safe.id);
  if (index >= 0) next[index] = { ...next[index], ...safe };
  else next.push(safe);
  await saveIntegrationData(key, next.slice(-1000), services);
  return index >= 0 ? next[index] : safe;
}

async function updateIntegrationItem(key, id, patch = {}, services = {}) {
  const existing = await getIntegrationItem(key, id, services);
  if (!existing) return null;
  return upsertIntegrationItem(key, { ...existing, ...patch, updatedAt: nowIso() }, services);
}

async function appendIntegrationItem(key, item, limit = 1000, services = {}) {
  const list = await loadIntegrationData(key, [], services);
  const safe = sanitizer.sanitizeConnectorResult({ ...item, id: item.id || createId('integration_item'), createdAt: item.createdAt || nowIso(), updatedAt: nowIso() });
  await saveIntegrationData(key, (Array.isArray(list) ? list : []).concat(safe).slice(-limit), services);
  return safe;
}

module.exports = {
  INTEGRATION_EVALUATION_GATE_RESULTS_KEY,
  INTEGRATION_EXECUTIONS_KEY,
  INTEGRATION_EXECUTION_RESULTS_KEY,
  INTEGRATION_PROPOSAL_PIPELINE_RUNS_KEY,
  INTEGRATION_QUALITY_GATE_RUNS_KEY,
  appendIntegrationItem,
  createId,
  getIntegrationItem,
  listIntegrationItems,
  loadIntegrationData,
  nowIso,
  saveIntegrationData,
  updateIntegrationItem,
  upsertIntegrationItem
};

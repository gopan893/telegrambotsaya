'use strict';

const store = require('./model-router-store');
const utils = require('./model-router-utils');
const fallbackManager = require('./model-fallback-manager');

async function checkAllModelProviders(services = {}) {
  const s = await store.loadModelStore(services);
  const providers = s.providers.length ? s.providers : [];
  const results = [];
  for (const p of providers) {
    results.push(await checkProviderHealth(p, services));
  }
  return results;
}

async function checkProviderHealth(provider, services = {}) {
  const enabled = fallbackManager.isEnabled(provider, services);
  if (!enabled) return { id: provider.id, name: provider.name, status: 'disabled', healthy: false };
  if (provider.type === 'fallback') return { id: provider.id, name: provider.name, status: 'available', healthy: true };
  if (provider.type === 'local') return await checkLocalModelHealth(services);
  return await checkCloudModelHealth(services);
}

async function checkLocalModelHealth(services = {}) {
  try {
    const localAdapter = require('./local-model-adapter');
    const avail = await localAdapter.checkLocalModelAvailability(services);
    return { id: 'local', name: 'Local AI', status: avail.available ? 'available' : 'unavailable', healthy: avail.available, detail: avail.reason || '' };
  } catch (e) {
    return { id: 'local', name: 'Local AI', status: 'error', healthy: false, detail: e.message || 'Unknown error' };
  }
}

async function checkCloudModelHealth(services = {}) {
  return { id: 'cloud', name: 'Cloud Provider', status: 'unknown', healthy: true, detail: 'Health check not implemented (no real call).' };
}

function buildModelHealthReport(results = [], services = {}) {
  const total = results.length;
  const healthy = results.filter(r => r.healthy).length;
  const names = results.map(r => ({ name: r.name, status: r.status }));
  return { total, healthy, degraded: total - healthy, providers: names, summary: `${healthy}/${total} providers healthy.` };
}

module.exports = { checkAllModelProviders, checkProviderHealth, checkLocalModelHealth, checkCloudModelHealth, buildModelHealthReport };

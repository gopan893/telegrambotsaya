'use strict';

const store = require('./model-router-store');

async function createModelFallbackChain(task = {}, context = {}, services = {}) {
  const s = await store.loadModelStore(services);
  const providers = s.providers;
  const chain = [];
  if (task.privacyLevel === 'high' || context.privacyMode === 'local_preferred') {
    const local = providers.find(p => p.type === 'local' && isEnabled(p, services));
    if (local) chain.push({ providerId: local.id, provider: local.name, type: 'local', reason: 'Privacy preferred' });
  }
  const cloudProviders = providers.filter(p => p.type === 'cloud' && isEnabled(p, services));
  if (context.economyMode) {
    const cheap = cloudProviders.filter(p => p.costTier === 'low');
    if (cheap.length) chain.push({ providerId: cheap[0].id, provider: cheap[0].name, type: 'cloud', reason: 'Economy mode' });
  }
  if (task.class === 'coding_heavy' || task.class === 'research') {
    const quality = cloudProviders.filter(p => p.costTier === 'high' || p.costTier === 'medium');
    if (quality.length) chain.push({ providerId: quality[0].id, provider: quality[0].name, type: 'cloud', reason: 'Quality needed' });
  }
  const anyLocal = providers.find(p => p.type === 'local' && isEnabled(p, services));
  if (anyLocal && !chain.some(c => c.type === 'local')) chain.push({ providerId: anyLocal.id, provider: anyLocal.name, type: 'local', reason: 'Fallback to local' });
  const fallback = providers.find(p => p.type === 'fallback');
  chain.push({ providerId: fallback?.id || 'fallback_stub', provider: 'Fallback Stub', type: 'fallback', reason: 'No other model available' });
  return chain;
}

async function fallbackOnTimeout(route = {}, services = {}) {
  return { ...route, fallbackReason: 'timeout', type: 'local' };
}

async function fallbackOnProviderUnavailable(route = {}, services = {}) {
  return { ...route, fallbackReason: 'provider_unavailable', type: 'local' };
}

async function fallbackOnBudgetExceeded(route = {}, services = {}) {
  return { ...route, fallbackReason: 'budget_exceeded', type: 'local' };
}

async function fallbackOnPrivacyBlocked(route = {}, services = {}) {
  return { ...route, fallbackReason: 'privacy_blocked', type: 'local' };
}

function isEnabled(provider, services) {
  const envKey = provider.enabledEnv;
  if (!envKey) return provider.type === 'fallback';
  const val = services?.env?.[envKey] || process.env[envKey] || '';
  if (provider.type === 'cloud') return val === provider.id || val === '*';
  if (provider.type === 'local') return val === 'true' || val === '1';
  return !!val;
}

module.exports = { createModelFallbackChain, fallbackOnTimeout, fallbackOnProviderUnavailable, fallbackOnBudgetExceeded, fallbackOnPrivacyBlocked, isEnabled };

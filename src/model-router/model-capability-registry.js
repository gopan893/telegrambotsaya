'use strict';

const utils = require('./model-router-utils');
const store = require('./model-router-store');
const providerRegistry = require('./model-provider-registry');

async function registerModelCapability(input, services = {}) {
  const entry = {
    id: input.id || utils.createId('cap'),
    providerId: input.providerId || '',
    modelName: utils.sanitizeText(input.modelName, 100),
    capability: input.capability || 'chat',
    qualityTier: input.qualityTier || 3,
    speedTier: input.speedTier || 3,
    costTier: input.costTier || 3,
    privacyTier: input.privacyTier || 3,
    maxContext: Number(input.maxContext) || 4096,
    enabled: input.enabled !== false,
    createdAt: new Date().toISOString()
  };
  const s = await store.loadModelStore(services);
  s.capabilities.push(entry);
  await store.saveModelStore(s, services);
  return entry;
}

async function getDefaultCapabilities(services = {}) {
  const s = await store.loadModelStore(services);
  if (s.capabilities.length) return s.capabilities;
  const providers = await providerRegistry.getDefaultProviders(services);
  const defaults = [];
  for (const p of providers) {
    if (p.type === 'fallback') continue;
    defaults.push({ id: utils.createId('cap'), providerId: p.id, modelName: 'default', capability: 'chat', qualityTier: p.type === 'cloud' ? 4 : 3, speedTier: 3, costTier: p.costTier === 'low' ? 2 : p.costTier === 'medium' ? 3 : 4, privacyTier: p.privacyLevel === 'high' ? 5 : p.privacyLevel === 'medium' ? 3 : 2, maxContext: 8192, enabled: true });
    if (p.supportsVision) defaults.push({ id: utils.createId('cap'), providerId: p.id, modelName: 'vision', capability: 'vision', qualityTier: 4, speedTier: 3, costTier: p.costTier === 'low' ? 2 : p.costTier === 'medium' ? 3 : 4, privacyTier: p.privacyLevel === 'high' ? 5 : p.privacyLevel === 'medium' ? 3 : 2, maxContext: 4096, enabled: true });
    if (p.supportsTools) defaults.push({ id: utils.createId('cap'), providerId: p.id, modelName: 'tools', capability: 'tool_use', qualityTier: 4, speedTier: 3, costTier: p.costTier === 'low' ? 2 : p.costTier === 'medium' ? 3 : 4, privacyTier: p.privacyLevel === 'high' ? 5 : p.privacyLevel === 'medium' ? 3 : 2, maxContext: 4096, enabled: true });
    if (p.supportsJson) defaults.push({ id: utils.createId('cap'), providerId: p.id, modelName: 'json', capability: 'json', qualityTier: 4, speedTier: 3, costTier: p.costTier === 'low' ? 2 : p.costTier === 'medium' ? 3 : 4, privacyTier: p.privacyLevel === 'high' ? 5 : p.privacyLevel === 'medium' ? 3 : 2, maxContext: 4096, enabled: true });
  }
  s.capabilities = defaults;
  await store.saveModelStore(s, services);
  return defaults;
}

async function listCapabilities(filters = {}, services = {}) {
  const caps = await getDefaultCapabilities(services);
  if (filters.providerId) return caps.filter(c => c.providerId === filters.providerId);
  if (filters.capability) return caps.filter(c => c.capability === filters.capability);
  if (filters.enabled !== undefined) return caps.filter(c => c.enabled === !!filters.enabled);
  return caps;
}

module.exports = { registerModelCapability, getDefaultCapabilities, listCapabilities };

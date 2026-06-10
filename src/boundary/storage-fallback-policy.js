'use strict';

const utils = require('./storage-boundary-utils');
const store = require('./storage-boundary-store');

const DEFAULT_POLICIES = {
  core: { primary: 'postgres', fallback: null, allowDowngrade: false, reason: 'core must use durable storage always' },
  dashboard: { primary: 'redis', fallback: 'memory', allowDowngrade: true, reason: 'dashboard sessions ok in memory' },
  'telegram-control': { primary: 'redis', fallback: 'memory', allowDowngrade: true, reason: 'state ok in memory' },
  agents: { primary: 'postgres', fallback: null, allowDowngrade: false, reason: 'agents require durable storage' },
  executor: { primary: 'postgres', fallback: null, allowDowngrade: false, reason: 'executor requires durable storage' },
  evaluation: { primary: 'postgres', fallback: 'json', allowDowngrade: false, reason: 'evaluation prefers durable' },
  governance: { primary: 'postgres', fallback: null, allowDowngrade: false, reason: 'governance requires durable' },
  security: { primary: 'postgres', fallback: null, allowDowngrade: false, reason: 'security requires durable' },
  privacy: { primary: 'postgres', fallback: null, allowDowngrade: false, reason: 'privacy requires durable' },
  reliability: { primary: 'postgres', fallback: 'json', allowDowngrade: false, reason: 'reliability prefers durable' },
  monitoring: { primary: 'redis', fallback: 'memory', allowDowngrade: true, reason: 'monitoring ok in memory' },
  cost: { primary: 'postgres', fallback: null, allowDowngrade: false, reason: 'cost requires durable' },
  operator: { primary: 'postgres', fallback: null, allowDowngrade: false, reason: 'operator requires durable' },
  lifeos: { primary: 'postgres', fallback: 'json', allowDowngrade: false, reason: 'lifeos private data must not silently downgrade' },
  knowledge: { primary: 'postgres', fallback: 'json', allowDowngrade: false, reason: 'knowledge prefers durable' },
  plugins: { primary: 'json', fallback: 'memory', allowDowngrade: true, reason: 'plugins config fallback ok' }
};

function getStorageFallbackPolicy(moduleName, services) {
  const policy = DEFAULT_POLICIES[moduleName];
  if (policy) return { module: moduleName, ...policy };
  return { module: moduleName, primary: 'postgres', fallback: null, allowDowngrade: false, reason: 'default: durable required' };
}

function validateStorageFallbackPolicy(policy, services) {
  if (!policy) return { valid: false, issues: ['policy is null'] };
  const issues = [];
  if (!policy.primary) issues.push('missing primary storage');
  if (!policy.module) issues.push('missing module');
  if (policy.allowDowngrade && policy.reason && policy.reason.includes('must not silently downgrade')) {
    issues.push('policy says no silent downgrade but allowDowngrade is true');
  }
  return { valid: issues.length === 0, issues };
}

function decideStorageFallback(moduleName, error, services) {
  const policy = getStorageFallbackPolicy(moduleName, services);
  if (!policy.fallback) return { fallback: null, allowed: false, reason: policy.reason || 'no fallback defined' };
  const access = store.getStorageAccessForModule(moduleName);
  const highSensitivityWrites = access.filter(a => a.sensitivity === 'high' && a.accessType === 'write');
  if (highSensitivityWrites.length > 0 && !policy.allowDowngrade) {
    return { fallback: null, allowed: false, reason: `high sensitivity writes blocked from fallback for ${moduleName}` };
  }
  return {
    fallback: policy.fallback,
    allowed: policy.allowDowngrade,
    from: policy.primary,
    reason: policy.allowDowngrade ? `fallback to ${policy.fallback} permitted: ${policy.reason}` : `fallback to ${policy.fallback} blocked: ${policy.reason}`
  };
}

function buildStorageFallbackExplanation(moduleName, services) {
  const policy = getStorageFallbackPolicy(moduleName, services);
  const access = store.getStorageAccessForModule(moduleName);
  return {
    module: moduleName,
    policy,
    storageAccessCount: access.length,
    sensitiveAccesses: access.filter(a => a.sensitivity === 'high').map(a => ({ id: a.id, accessType: a.accessType, storageType: a.storageType })),
    allowedDowngrade: policy.allowDowngrade,
    explanation: policy.reason
  };
}

module.exports = {
  getStorageFallbackPolicy,
  validateStorageFallbackPolicy,
  decideStorageFallback,
  buildStorageFallbackExplanation
};

'use strict';

const utils = require('./storage-boundary-utils');
const contract = require('./storage-adapter-contract');

function _safeValidate(name, fn, services) {
  try {
    return fn(services);
  } catch (err) {
    return { adapter: name, available: false, error: utils.safeCall(() => err.message, 'validation error') };
  }
}

function _genericValidate(adapterName, services) {
  const c = contract.buildStorageAdapterContract(adapterName, services);
  if (!c) return { adapter: adapterName, available: false, reason: 'no contract' };
  const v = contract.validateStorageAdapterContract(c, services);
  const caps = contract.checkStorageAdapterCapabilities(adapterName, services);
  return { adapter: adapterName, available: v.valid, valid: v.valid, issues: v.issues, capabilities: caps.capabilities || {} };
}

function validatePostgresAdapter(services) {
  return _genericValidate('postgres', services);
}

function validateRedisAdapter(services) {
  return _genericValidate('redis', services);
}

function validateJsonFallbackAdapter(services) {
  return _genericValidate('json-fallback', services);
}

function validateMemoryFallbackAdapter(services) {
  return _genericValidate('memory-fallback', services);
}

function validateAllStorageAdapters(services) {
  const adapters = ['postgres', 'redis', 'json-fallback', 'memory-fallback'];
  return adapters.map(name => _safeValidate(name, () => _genericValidate(name, services), services));
}

function buildStorageAdapterValidationReport(services) {
  const results = validateAllStorageAdapters(services);
  const total = results.length;
  const available = results.filter(r => r.available).length;
  return { total, available, degraded: total - available, results };
}

module.exports = {
  validateAllStorageAdapters,
  validatePostgresAdapter,
  validateRedisAdapter,
  validateJsonFallbackAdapter,
  validateMemoryFallbackAdapter,
  buildStorageAdapterValidationReport
};

'use strict';

const utils = require('./storage-boundary-utils');
const contract = require('./storage-adapter-contract');

const LEGACY_COMPAT_MAP = {
  'pg': 'postgres',
  'postgresql': 'postgres',
  'rdb': 'redis',
  'json-file': 'json-fallback',
  'jsonfile': 'json-fallback',
  'ram': 'memory-fallback',
  'memory': 'memory-fallback',
  'inmemory': 'memory-fallback'
};

function getLegacyStorageCompat(moduleName, services) {
  const compat = {};
  for (const [legacy, modern] of Object.entries(LEGACY_COMPAT_MAP)) {
    compat[legacy] = modern;
  }
  return { module: moduleName, legacyMap: compat };
}

function resolveStorageAdapterCompat(moduleName, services) {
  const legacy = getLegacyStorageCompat(moduleName, services);
  const c = contract.buildStorageAdapterContract('postgres', services);
  return {
    module: moduleName,
    resolved: true,
    modernAdapter: 'postgres',
    legacyMap: legacy.legacyMap,
    contract: c ? { id: c.id, name: c.name, type: c.type, safeForProduction: c.safeForProduction } : null
  };
}

function mapLegacyStorageToBoundaryContract(services) {
  const mapped = [];
  for (const [legacy, modern] of Object.entries(LEGACY_COMPAT_MAP)) {
    const c = contract.buildStorageAdapterContract(modern, services);
    mapped.push({
      legacyName: legacy,
      modernName: modern,
      resolved: !!c,
      contract: c ? { id: c.id, name: c.name, type: c.type, supportsRead: c.supportsRead, supportsWrite: c.supportsWrite } : null
    });
  }
  return mapped;
}

function buildStorageCompatibilityReport(services) {
  const mappings = mapLegacyStorageToBoundaryContract(services);
  const total = mappings.length;
  const resolved = mappings.filter(m => m.resolved).length;
  return { total, resolved, unresolved: total - resolved, mappings };
}

module.exports = {
  getLegacyStorageCompat,
  resolveStorageAdapterCompat,
  mapLegacyStorageToBoundaryContract,
  buildStorageCompatibilityReport
};

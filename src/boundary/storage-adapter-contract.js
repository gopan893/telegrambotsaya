'use strict';

const utils = require('./storage-boundary-utils');

const BUILTIN_CONTRACTS = [
  {
    id: 'adapter-postgres',
    name: 'postgres',
    type: 'relational',
    supportsRead: true,
    supportsWrite: true,
    supportsTransaction: true,
    supportsArchive: true,
    supportsSoftDelete: true,
    supportsHardDelete: true,
    supportsHealthCheck: true,
    requiredEnvNames: ['DATABASE_URL'],
    optionalEnvNames: ['PG_POOL_SIZE', 'PG_MAX_CLIENTS', 'PG_IDLE_TIMEOUT'],
    fallbackStrategy: 'none',
    safeForProduction: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'adapter-redis',
    name: 'redis',
    type: 'kv-cache',
    supportsRead: true,
    supportsWrite: true,
    supportsTransaction: false,
    supportsArchive: false,
    supportsSoftDelete: false,
    supportsHardDelete: true,
    supportsHealthCheck: true,
    requiredEnvNames: ['REDIS_URL'],
    optionalEnvNames: ['REDIS_PREFIX', 'REDIS_TTL'],
    fallbackStrategy: 'memory',
    safeForProduction: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'adapter-json-fallback',
    name: 'json-fallback',
    type: 'file-json',
    supportsRead: true,
    supportsWrite: true,
    supportsTransaction: false,
    supportsArchive: true,
    supportsSoftDelete: false,
    supportsHardDelete: true,
    supportsHealthCheck: true,
    requiredEnvNames: [],
    optionalEnvNames: ['JSON_FALLBACK_DIR'],
    fallbackStrategy: 'ephemeral',
    safeForProduction: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'adapter-memory-fallback',
    name: 'memory-fallback',
    type: 'in-memory',
    supportsRead: true,
    supportsWrite: true,
    supportsTransaction: false,
    supportsArchive: false,
    supportsSoftDelete: false,
    supportsHardDelete: true,
    supportsHealthCheck: true,
    requiredEnvNames: [],
    optionalEnvNames: [],
    fallbackStrategy: 'ephemeral',
    safeForProduction: true,
    createdAt: new Date().toISOString()
  }
];

function buildStorageAdapterContract(adapterName, services) {
  return BUILTIN_CONTRACTS.find(c => c.name === adapterName) || null;
}

function validateStorageAdapterContract(contract, services) {
  if (!contract) return { valid: false, issues: ['contract is null'] };
  const issues = [];
  if (!contract.id) issues.push('missing id');
  if (!contract.name) issues.push('missing name');
  if (!contract.type) issues.push('missing type');
  if (contract.requiredEnvNames) {
    const env = services && services.env ? services.env : process.env;
    for (const name of contract.requiredEnvNames) {
      if (!env[name]) issues.push(`missing required env: ${name}`);
    }
  }
  return { valid: issues.length === 0, issues };
}

function checkStorageAdapterCapabilities(adapterName, services) {
  const contract = buildStorageAdapterContract(adapterName, services);
  if (!contract) return { available: false, reason: 'no contract found' };
  const validation = validateStorageAdapterContract(contract, services);
  return {
    available: validation.valid,
    contract,
    capabilities: {
      read: contract.supportsRead,
      write: contract.supportsWrite,
      transaction: contract.supportsTransaction,
      archive: contract.supportsArchive,
      softDelete: contract.supportsSoftDelete,
      hardDelete: contract.supportsHardDelete,
      healthCheck: contract.supportsHealthCheck
    },
    issues: validation.issues
  };
}

function buildStorageAdapterContractReport(services) {
  const results = BUILTIN_CONTRACTS.map(c => {
    const caps = checkStorageAdapterCapabilities(c.name, services);
    return { name: c.name, type: c.type, ...caps };
  });
  return { total: BUILTIN_CONTRACTS.length, results };
}

module.exports = {
  buildStorageAdapterContract,
  validateStorageAdapterContract,
  checkStorageAdapterCapabilities,
  buildStorageAdapterContractReport,
  BUILTIN_CONTRACTS
};

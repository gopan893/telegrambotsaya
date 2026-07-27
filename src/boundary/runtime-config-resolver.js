'use strict';

const utils = require('./config-boundary-utils');
const envRegistry = require('./env-contract-registry');

function resolveRuntimeConfig(configName, services) {
  const env = services && services.env ? services.env : process.env;
  const contracts = envRegistry.buildEnvContractRegistry(services);
  const contract = contracts.find(c => c.name === configName);
  if (!contract) return { name: configName, resolved: false, reason: 'unknown config name' };
  const raw = env[configName];
  if (!raw && contract.defaultSafeValue) {
    return { name: configName, resolved: true, value: contract.defaultSafeValue, fromDefault: true, sensitive: contract.sensitive };
  }
  if (!raw) return { name: configName, resolved: false, reason: 'not configured and no default' };
  if (contract.sensitive) {
    return { name: configName, resolved: true, value: '[REDACTED]', sensitive: true, configured: true };
  }
  return { name: configName, resolved: true, value: raw, sensitive: false, configured: true };
}

function getSafeConfigSummary(services) {
  const contracts = envRegistry.buildEnvContractRegistry(services);
  return contracts.map(c => {
    const resolved = resolveRuntimeConfig(c.name, services);
    return {
      name: c.name,
      category: c.category,
      present: resolved.resolved,
      sensitive: c.sensitive,
      source: resolved.fromDefault ? 'default' : resolved.configured ? 'env' : 'missing',
      dangerousIfTrue: c.dangerousIfTrue
    };
  });
}

function buildRuntimeConfigReport(services) {
  const summary = getSafeConfigSummary(services);
  const total = summary.length;
  const present = summary.filter(s => s.present).length;
  const sensitive = summary.filter(s => s.sensitive).length;
  const dangerous = summary.filter(s => s.dangerousIfTrue).map(s => ({ name: s.name, present: s.present }));
  return {
    total,
    present,
    missing: total - present,
    sensitiveCount: sensitive,
    dangerousFlags: dangerous,
    configs: summary
  };
}

module.exports = {
  resolveRuntimeConfig,
  getSafeConfigSummary,
  buildRuntimeConfigReport
};

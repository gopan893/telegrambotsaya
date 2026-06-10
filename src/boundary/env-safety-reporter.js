'use strict';

const utils = require('./config-boundary-utils');
const envRegistry = require('./env-contract-registry');

function _getEnv(name, services) {
  const env = services && services.env ? services.env : process.env;
  return env[name];
}

function reportEnvSafety(services) {
  const contracts = envRegistry.buildEnvContractRegistry(services);
  const safe = [];
  const unsafe = [];
  const missing = [];
  const isProd = _getEnv('NODE_ENV', services) === 'production';
  for (const c of contracts) {
    const val = _getEnv(c.name, services);
    const present = val !== undefined && val !== null && val !== '';
    if (c.sensitive && present) {
      safe.push({ name: c.name, present: true, sensitive: true });
    } else if (c.sensitive && !present) {
      missing.push({ name: c.name, present: false, sensitive: true, required: c.requiredInProduction });
    } else if (isProd && c.requiredInProduction && !present) {
      unsafe.push({ name: c.name, present: false, requiredInProduction: true });
    }
  }
  return { safe, unsafe, missing, total: contracts.length, safeCount: safe.length, unsafeCount: unsafe.length, missingCount: missing.length };
}

function detectMissingProductionEnvs(services) {
  const contracts = envRegistry.buildEnvContractRegistry(services);
  const isProd = _getEnv('NODE_ENV', services) === 'production';
  if (!isProd) return [];
  const missing = [];
  for (const c of contracts) {
    if (c.requiredInProduction) {
      const val = _getEnv(c.name, services);
      if (!val) missing.push({ name: c.name, requiredInProduction: true });
    }
  }
  return missing;
}

function detectDangerousEnvStatus(services) {
  return envRegistry.detectDangerousEnvValuesByNameOnly(services);
}

function buildEnvSafetyReport(services) {
  const safety = reportEnvSafety(services);
  const missingProd = detectMissingProductionEnvs(services);
  const dangerous = detectDangerousEnvStatus(services);
  return {
    ...safety,
    missingProduction: missingProd,
    dangerousFlags: dangerous,
    readinessBlocked: dangerous.some(d => d.status === 'enabled')
  };
}

module.exports = {
  reportEnvSafety,
  detectMissingProductionEnvs,
  detectDangerousEnvStatus,
  buildEnvSafetyReport
};

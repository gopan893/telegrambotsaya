'use strict';

const utils = require('./config-boundary-utils');
const envRegistry = require('./env-contract-registry');

function _getEnv(name, services) {
  const env = services && services.env ? services.env : process.env;
  return env[name];
}

function validateConfigContracts(services) {
  const contracts = envRegistry.buildEnvContractRegistry(services);
  const issues = [];
  const isProd = _getEnv('NODE_ENV', services) === 'production';
  for (const c of contracts) {
    if (isProd && c.requiredInProduction) {
      const val = _getEnv(c.name, services);
      if (!val) {
        issues.push({ name: c.name, issue: 'missing required config in production', severity: 'error' });
      }
    }
  }
  return { valid: issues.length === 0, issues };
}

function checkRequiredConfigs(services) {
  const contracts = envRegistry.buildEnvContractRegistry(services);
  const missing = [];
  const isProd = _getEnv('NODE_ENV', services) === 'production';
  for (const c of contracts) {
    if (isProd && c.requiredInProduction) {
      const val = _getEnv(c.name, services);
      if (!val) missing.push({ name: c.name, requiredInProduction: true });
    }
  }
  return missing;
}

function checkDangerousConfigs(services) {
  return envRegistry.detectDangerousEnvValuesByNameOnly(services);
}

function buildConfigValidationReport(services) {
  const validation = validateConfigContracts(services);
  const required = checkRequiredConfigs(services);
  const dangerous = checkDangerousConfigs(services);
  const activeDangerous = dangerous.filter(d => d.status === 'enabled');
  return {
    valid: validation.valid,
    totalContracts: validation.issues.length + (validation.valid ? 1 : 0),
    issues: validation.issues,
    missingRequired: required,
    dangerousFlags: dangerous,
    readinessBlocked: activeDangerous.length > 0,
    readinessBlockers: activeDangerous.map(d => d.name)
  };
}

module.exports = {
  validateConfigContracts,
  checkRequiredConfigs,
  checkDangerousConfigs,
  buildConfigValidationReport
};

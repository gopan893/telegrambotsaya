'use strict';

const utils = require('./module-boundary-utils');
const registry = require('./module-manifest-registry');
const lifecycle = require('./module-lifecycle-manager');
const importGuard = require('./module-import-guard');

function certifyModuleHealth(moduleName, services) {
  const manifest = registry.buildModuleManifestFromRegistry(moduleName, services);
  if (!manifest) return { module: moduleName, healthy: false, reason: 'no manifest found', score: 0 };
  const manifestValidation = registry.validateModuleManifest(manifest, services);
  const statusInfo = lifecycle.getModuleLifecycleStatus(moduleName, services);
  const degraded = statusInfo.status === 'degraded' || statusInfo.status === 'failed' || statusInfo.status === 'disabled';
  const checks = {
    manifestExists: !!manifest,
    manifestValid: manifestValidation.valid,
    statusStable: !degraded
  };
  const passed = Object.values(checks).filter(Boolean).length;
  const total = Object.values(checks).length;
  const score = utils.buildScore(passed, total);
  const healthy = score >= 66;
  return { module: moduleName, healthy, score, checks, status: statusInfo.status };
}

function certifyAllModuleHealth(services) {
  const all = registry.listModuleManifests({}, services);
  const results = all.map(m => utils.safeCall(() => certifyModuleHealth(m.module, services), { module: m.module, healthy: false, error: 'certification failed' }));
  return results;
}

function buildModuleHealthReport(services) {
  const results = certifyAllModuleHealth(services);
  const healthy = results.filter(r => r.healthy).length;
  const total = results.length;
  return {
    total,
    healthy,
    degraded: total - healthy,
    score: utils.buildScore(healthy, total),
    results
  };
}

module.exports = {
  certifyModuleHealth,
  certifyAllModuleHealth,
  buildModuleHealthReport
};

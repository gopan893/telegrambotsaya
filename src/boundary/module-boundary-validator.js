'use strict';

const utils = require('./module-boundary-utils');
const registry = require('./module-manifest-registry');
const depMap = require('./module-dependency-map');

function validateModuleBoundary(moduleName, services) {
  const manifest = registry.buildModuleManifestFromRegistry(moduleName, services);
  if (!manifest) return { module: moduleName, valid: false, checks: { manifestExists: false }, score: 0 };
  const checks = {
    manifestExists: true,
    hasModuleName: !!manifest.module,
    hasCriticality: !!manifest.criticality,
    hasDependencies: Array.isArray(manifest.dependencies)
  };
  const passed = Object.values(checks).filter(Boolean).length;
  const total = Object.values(checks).length;
  const score = utils.buildScore(passed, total);
  const valid = passed === total;
  return { module: moduleName, valid, score, checks };
}

function validateAllModuleBoundaries(services) {
  const all = registry.listModuleManifests({}, services);
  return all.map(m => utils.safeCall(() => validateModuleBoundary(m.module, services), { module: m.module, valid: false, error: 'validation failed' }));
}

function buildModuleBoundaryValidationReport(services) {
  const results = validateAllModuleBoundaries(services);
  const valid = results.filter(r => r.valid).length;
  const total = results.length;
  return {
    total,
    valid,
    invalid: total - valid,
    score: utils.buildScore(valid, total),
    results
  };
}

module.exports = {
  validateModuleBoundary,
  validateAllModuleBoundaries,
  buildModuleBoundaryValidationReport
};

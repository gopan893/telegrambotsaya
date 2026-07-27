'use strict';

const registry = require('./module-manifest-registry');
const depMap = require('./module-dependency-map');
const lifecycle = require('./module-lifecycle-manager');
const healthCertifier = require('./module-health-certifier');
const boundaryValidator = require('./module-boundary-validator');
const importGuard = require('./module-import-guard');

function generateModuleBoundaryReport(services) {
  const manifestReport = registry.buildModuleManifestReport(services);
  const depMapReport = depMap.buildDependencyMapReport(services);
  const lifecycleReport = lifecycle.buildModuleLifecycleReport(services);
  const healthReport = healthCertifier.buildModuleHealthReport(services);
  const validationReport = boundaryValidator.buildModuleBoundaryValidationReport(services);
  const importGuardReport = importGuard.buildImportGuardReport(services);

  return {
    generatedAt: new Date().toISOString(),
    manifests: manifestReport,
    dependencyMap: depMapReport,
    lifecycle: lifecycleReport,
    health: healthReport,
    validation: validationReport,
    importGuard: importGuardReport
  };
}

module.exports = {
  generateModuleBoundaryReport
};

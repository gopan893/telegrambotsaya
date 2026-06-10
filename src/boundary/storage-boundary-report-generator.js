'use strict';

const store = require('./storage-boundary-store');
const registry = require('./storage-access-registry');
const adapterContract = require('./storage-adapter-contract');
const adapterValidator = require('./storage-adapter-validator');
const healthChecker = require('./storage-health-checker');
const fallbackPolicy = require('./storage-fallback-policy');
const migrationPlanner = require('./storage-migration-planner');
const compatBridge = require('./storage-compatibility-bridge');

function generateStorageBoundaryReport(services) {
  const registryReport = registry.buildStorageAccessReport(services);
  const adapterContractReport = adapterContract.buildStorageAdapterContractReport(services);
  const adapterValidationReport = adapterValidator.buildStorageAdapterValidationReport(services);
  const healthResults = healthChecker.checkAllStorageHealth(services);
  const healthReport = healthChecker.buildStorageHealthReport(healthResults, services);
  const compatReport = compatBridge.buildStorageCompatibilityReport(services);

  return {
    generatedAt: new Date().toISOString(),
    registry: registryReport,
    adapterContracts: adapterContractReport,
    adapterValidation: adapterValidationReport,
    health: healthReport,
    compatibility: compatReport
  };
}

module.exports = {
  generateStorageBoundaryReport
};

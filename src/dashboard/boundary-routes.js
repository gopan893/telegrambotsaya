'use strict';

const express = require('express');
const storageAccess = require('../boundary/storage-access-registry');
const adapterContract = require('../boundary/storage-adapter-contract');
const adapterValidator = require('../boundary/storage-adapter-validator');
const healthChecker = require('../boundary/storage-health-checker');
const fallbackPolicy = require('../boundary/storage-fallback-policy');
const migrationPlanner = require('../boundary/storage-migration-planner');
const compatBridge = require('../boundary/storage-compatibility-bridge');
const storageReport = require('../boundary/storage-boundary-report-generator');
const moduleManifest = require('../boundary/module-manifest-registry');
const depMap = require('../boundary/module-dependency-map');
const lifecycle = require('../boundary/module-lifecycle-manager');
const optionalResolver = require('../boundary/optional-module-resolver');
const importGuard = require('../boundary/module-import-guard');
const moduleHealth = require('../boundary/module-health-certifier');
const moduleValidator = require('../boundary/module-boundary-validator');
const moduleReport = require('../boundary/module-boundary-report-generator');
const envContract = require('../boundary/env-contract-registry');
const configValidator = require('../boundary/config-contract-validator');
const envSafety = require('../boundary/env-safety-reporter');

function registerBoundaryRoutes(router, services = {}) {
  router.get('/boundary', async (req, res) => {
    try {
      const [storage, moduleB, env] = await Promise.all([
        storageReport.generateStorageBoundaryReport(services),
        moduleReport.generateModuleBoundaryReport(services),
        envSafety.reportEnvSafety(services)
      ]);
      res.json({ ok: true, status: 'ready', data: { storage, moduleBoundary: moduleB, env } });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/boundary/storage-access', async (req, res) => {
    try {
      const report = await storageAccess.buildStorageAccessReport(services);
      res.json({ ok: true, status: 'ready', data: report });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/boundary/storage-health', async (req, res) => {
    try {
      const results = await healthChecker.checkAllStorageHealth(services);
      const report = await healthChecker.buildStorageHealthReport(results, services);
      res.json({ ok: true, status: 'ready', data: report });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/boundary/storage-contracts', async (req, res) => {
    try {
      const report = await adapterContract.buildStorageAdapterContractReport(services);
      res.json({ ok: true, status: 'ready', data: report });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/boundary/storage-fallback', async (req, res) => {
    try {
      const policy = await fallbackPolicy.getStorageFallbackPolicy('all', services);
      res.json({ ok: true, status: 'ready', data: policy });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.post('/boundary/migration-plan', async (req, res) => {
    try {
      const plan = await migrationPlanner.createStorageMigrationPlan(req.body, services);
      res.json({ ok: true, status: 'ready', data: plan });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/boundary/modules', async (req, res) => {
    try {
      const manifests = await moduleManifest.listModuleManifests(req.query, services);
      res.json({ ok: true, status: 'ready', data: manifests });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/boundary/dependencies', async (req, res) => {
    try {
      const report = await depMap.buildDependencyMapReport(services);
      res.json({ ok: true, status: 'ready', data: report });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/boundary/optional-modules', async (req, res) => {
    try {
      const result = await optionalResolver.detectUnsafeRequiredOptionalModules(services);
      res.json({ ok: true, status: 'ready', data: result });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/boundary/import-guard', async (req, res) => {
    try {
      const report = await importGuard.buildImportGuardReport(services);
      res.json({ ok: true, status: 'ready', data: report });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/boundary/env-contracts', async (req, res) => {
    try {
      const report = await envContract.buildEnvContractReport(services);
      res.json({ ok: true, status: 'ready', data: report });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/boundary/report', async (req, res) => {
    try {
      const [storage, moduleB, env] = await Promise.all([
        storageReport.generateStorageBoundaryReport(services),
        moduleReport.generateModuleBoundaryReport(services),
        envSafety.reportEnvSafety(services)
      ]);
      res.json({ ok: true, status: 'ready', data: { storage, moduleBoundary: moduleB, env } });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });
}

module.exports = { registerBoundaryRoutes };

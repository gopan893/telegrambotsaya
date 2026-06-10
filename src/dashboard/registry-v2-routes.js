'use strict';

const express = require('express');
const tabRegistry = require('../registry-v2/dashboard-tab-registry-v2');
const apiRegistry = require('../registry-v2/dashboard-api-registry-v2');
const cmdRegistry = require('../registry-v2/telegram-command-registry-v2');
const capRegistry = require('../registry-v2/capability-registry-v2');
const aliasRegistry = require('../registry-v2/alias-registry-v2');
const normalizer = require('../registry-v2/registry-v2-normalizer');
const validator = require('../registry-v2/registry-v2-validator');
const compatBridge = require('../registry-v2/registry-v2-compatibility-bridge');
const conflictDetector = require('../registry-v2/registry-v2-conflict-detector');
const reportGenerator = require('../registry-v2/registry-v2-report-generator');

function registerRegistryV2Routes(router, services = {}) {
  router.get('/registry-v2', async (req, res) => {
    try {
      const report = await reportGenerator.generateRegistryV2Report(services);
      res.json({ ok: true, status: 'ready', data: report });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.post('/registry-v2/normalize', async (req, res) => {
    try {
      const result = await normalizer.normalizeAllRegistriesV2(services);
      res.json({ ok: true, status: 'ready', data: result });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.post('/registry-v2/validate', async (req, res) => {
    try {
      const result = await validator.validateAllRegistriesV2(services);
      res.json({ ok: true, status: 'ready', data: result });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/registry-v2/tabs', async (req, res) => {
    try {
      const registry = await tabRegistry.buildDashboardTabRegistryV2(services);
      const validation = await tabRegistry.validateDashboardTabRegistryV2(registry, services);
      res.json({ ok: true, status: 'ready', data: { registry, validation } });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/registry-v2/apis', async (req, res) => {
    try {
      const registry = await apiRegistry.buildDashboardApiRegistryV2(services);
      const validation = await apiRegistry.validateDashboardApiRegistryV2(registry, services);
      res.json({ ok: true, status: 'ready', data: { registry, validation } });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/registry-v2/commands', async (req, res) => {
    try {
      const registry = await cmdRegistry.buildTelegramCommandRegistryV2(services);
      const validation = await cmdRegistry.validateTelegramCommandRegistryV2(registry, services);
      res.json({ ok: true, status: 'ready', data: { registry, validation } });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/registry-v2/capabilities', async (req, res) => {
    try {
      const registry = await capRegistry.buildCapabilityRegistryV2(services);
      const validation = await capRegistry.validateCapabilityRegistryV2(registry, services);
      res.json({ ok: true, status: 'ready', data: { registry, validation } });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/registry-v2/aliases', async (req, res) => {
    try {
      const report = await aliasRegistry.buildAliasReport(services);
      res.json({ ok: true, status: 'ready', data: report });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/registry-v2/conflicts', async (req, res) => {
    try {
      const report = await conflictDetector.buildRegistryConflictReport(services);
      res.json({ ok: true, status: 'ready', data: report });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/registry-v2/compatibility', async (req, res) => {
    try {
      const report = await compatBridge.buildCompatibilityBridgeReport(services);
      res.json({ ok: true, status: 'ready', data: report });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/registry-v2/report', async (req, res) => {
    try {
      const report = await reportGenerator.generateRegistryV2Report(services);
      res.json({ ok: true, status: 'ready', data: report });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });
}

module.exports = { registerRegistryV2Routes };

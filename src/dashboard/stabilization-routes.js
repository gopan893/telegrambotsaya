'use strict';

const express = require('express');
const lockManager = require('../stabilization/v1-final-lock-manager');
const readinessGate = require('../stabilization/v1-final-readiness-gate');
const cpCertifier = require('../stabilization/control-panel-certifier');
const apiCertifier = require('../stabilization/dashboard-api-certifier');
const pwaCertifier = require('../stabilization/pwa-mobile-certifier');
const telegramCertifier = require('../stabilization/telegram-command-certifier');
const safetyCertifier = require('../stabilization/safety-boundary-certifier');
const reportGenerator = require('../stabilization/stabilization-report-generator');
const guards = require('./dashboard-guards');

function registerStabilizationRoutes(router, services = {}) {
  router.get('/stabilization', async (req, res) => {
    try {
      const report = await reportGenerator.generateStabilizationReport(services);
      res.json({ ok: true, status: 'ready', data: report });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.post('/stabilization/start-lock', async (req, res) => {
    try {
      const lock = await lockManager.startV1FinalLock(services);
      res.json({ ok: true, status: 'locked', data: { lock } });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/stabilization/lock-status', async (req, res) => {
    try {
      const status = await lockManager.getV1FinalLockStatus(services);
      res.json({ ok: true, status: 'ready', data: status });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.post('/stabilization/readiness-gate', async (req, res) => {
    try {
      const result = await readinessGate.runV1FinalReadinessGate(services);
      res.json({ ok: true, status: 'ready', data: result });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/stabilization/certify-control-panel', async (req, res) => {
    try {
      const result = await cpCertifier.certifyAllControlPanel(services);
      res.json({ ok: true, status: 'ready', data: result });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/stabilization/certify-api', async (req, res) => {
    try {
      const result = await apiCertifier.certifyAllDashboardApis(services);
      res.json({ ok: true, status: 'ready', data: result });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/stabilization/certify-pwa-mobile', async (req, res) => {
    try {
      const result = await pwaCertifier.certifyAllPwaMobile(services);
      res.json({ ok: true, status: 'ready', data: result });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/stabilization/certify-telegram', async (req, res) => {
    try {
      const result = await telegramCertifier.certifyAllTelegram(services);
      res.json({ ok: true, status: 'ready', data: result });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/stabilization/certify-safety', async (req, res) => {
    try {
      const result = await safetyCertifier.certifyAllSafetyBoundaries(services);
      res.json({ ok: true, status: 'ready', data: result });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/stabilization/report', async (req, res) => {
    try {
      const report = await reportGenerator.generateStabilizationReport(services);
      res.json({ ok: true, status: 'ready', data: report });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });
}

module.exports = { registerStabilizationRoutes };

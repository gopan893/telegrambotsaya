'use strict';

const express = require('express');
const startupProfiler = require('../performance/startup-profiler');
const importCost = require('../performance/import-cost-analyzer');
const bundleAuditor = require('../performance/dashboard-bundle-auditor');
const lazyLoader = require('../performance/dashboard-lazy-loader-planner');
const apiProfiler = require('../performance/api-response-profiler');
const payloadAuditor = require('../performance/payload-size-auditor');
const cacheAuditor = require('../performance/cache-efficiency-auditor');
const budgetMgr = require('../performance/performance-budget-manager');
const regressionDetector = require('../performance/performance-regression-detector');
const scorecard = require('../performance/performance-scorecard');
const perfReport = require('../performance/performance-report-generator');

function registerPerformanceRoutes(router, services = {}) {
  router.get('/performance', async (req, res) => {
    try {
      const report = await perfReport.generatePerformanceReport(services);
      res.json({ ok: true, status: 'ready', data: report });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.post('/performance/profile-startup', async (req, res) => {
    try {
      const report = await startupProfiler.buildStartupPerformanceReport(services);
      res.json({ ok: true, status: 'ready', data: report });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/performance/import-cost', async (req, res) => {
    try {
      const report = await importCost.buildImportCostReport(services);
      res.json({ ok: true, status: 'ready', data: report });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/performance/dashboard-bundle', async (req, res) => {
    try {
      const report = await bundleAuditor.buildDashboardBundleReport(services);
      res.json({ ok: true, status: 'ready', data: report });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.post('/performance/api-profile', async (req, res) => {
    try {
      const report = await apiProfiler.buildApiResponsePerformanceReport(services);
      res.json({ ok: true, status: 'ready', data: report });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/performance/payloads', async (req, res) => {
    try {
      const report = await payloadAuditor.buildPayloadSizeReport(services);
      res.json({ ok: true, status: 'ready', data: report });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/performance/cache', async (req, res) => {
    try {
      const report = await cacheAuditor.buildCacheEfficiencyReport(services);
      res.json({ ok: true, status: 'ready', data: report });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/performance/budgets', async (req, res) => {
    try {
      const budgets = await budgetMgr.buildDefaultPerformanceBudgets(services);
      res.json({ ok: true, status: 'ready', data: budgets });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.post('/performance/budgets/evaluate', async (req, res) => {
    try {
      const result = await budgetMgr.evaluatePerformanceBudgets(services);
      const report = await budgetMgr.buildPerformanceBudgetReport(services);
      res.json({ ok: true, status: 'ready', data: { evaluation: result, report } });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/performance/regressions', async (req, res) => {
    try {
      const report = await regressionDetector.buildPerformanceRegressionReport(services);
      res.json({ ok: true, status: 'ready', data: report });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/performance/scorecard', async (req, res) => {
    try {
      const card = await scorecard.calculatePerformanceScorecard(services);
      res.json({ ok: true, status: 'ready', data: card });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/performance/report', async (req, res) => {
    try {
      const report = await perfReport.generatePerformanceReport(services);
      res.json({ ok: true, status: 'ready', data: report });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });
}

module.exports = { registerPerformanceRoutes };

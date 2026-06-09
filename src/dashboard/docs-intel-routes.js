'use strict';

const docsIntel = require('../docs-intel');
const fs = require('fs');

function registerDocsIntelRoutes(router, services = {}) {
  const svc = { ...services, fs };

  router.get('/docs-intel', async (req, res) => {
    try {
      res.json({ ok: true, status: 'docs-intel routes active', endpoints: ['scan', 'inventory', 'gaps', 'freshness', 'update-plan', 'prompt'] });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.post('/docs-intel/scan', async (req, res) => {
    try {
      const inventory = await docsIntel.docsInventoryScanner.scanProjectDocs(svc);
      const report = await docsIntel.docsInventoryScanner.buildDocsInventoryReport(inventory, svc);
      res.json({ ok: true, inventory: report });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/docs-intel/inventory', async (req, res) => {
    try {
      const inventory = await docsIntel.docsInventoryScanner.scanProjectDocs(svc);
      const report = await docsIntel.docsInventoryScanner.buildDocsInventoryReport(inventory, svc);
      res.json({ ok: true, inventory: report });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/docs-intel/gaps', async (req, res) => {
    try {
      const gaps = await docsIntel.docsGapDetector.detectDocsGaps(svc);
      const report = await docsIntel.docsGapDetector.generateDocsGapReport(svc);
      res.json({ ok: true, gaps: report });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/docs-intel/freshness', async (req, res) => {
    try {
      const warnings = await docsIntel.docsFreshnessReviewer.reviewDocsFreshness(svc);
      res.json({ ok: true, warnings });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.post('/docs-intel/update-plan', async (req, res) => {
    try {
      const gaps = await docsIntel.docsGapDetector.detectDocsGaps(svc);
      const gapReport = await docsIntel.docsGapDetector.generateDocsGapReport(svc);
      const plan = await docsIntel.docsUpdatePlanGenerator.createDocsUpdatePlan(gapReport, svc);
      res.json({ ok: true, plan });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.post('/docs-intel/prompt', async (req, res) => {
    try {
      const gaps = await docsIntel.docsGapDetector.detectDocsGaps(svc);
      const gapReport = await docsIntel.docsGapDetector.generateDocsGapReport(svc);
      const plan = await docsIntel.docsUpdatePlanGenerator.createDocsUpdatePlan(gapReport, svc);
      const prompt = await docsIntel.docsUpdatePlanGenerator.createDocsUpdatePrompt(plan, svc);
      res.json({ ok: true, prompt });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });
}

module.exports = { registerDocsIntelRoutes };

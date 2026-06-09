'use strict';

const consolidation = require('../consolidation');

function registerConsolidationRoutes(router, services = {}) {
  const svc = { ...services, env: process.env };

  router.get('/consolidation', (req, res) => {
    try {
      res.json({ ok: true, status: 'Consolidation routes active', endpoints: ['audit', 'modules', 'duplicates', 'routes', 'commands', 'capabilities', 'dashboard-registry', 'docs', 'tests', 'performance', 'v2-roadmap', 'report'] });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.post('/consolidation/audit', async (req, res) => {
    try {
      const result = await consolidation.architectureAuditor.runArchitectureAudit(svc);
      consolidation.consolidationStore.setAuditResult('architecture', result);
      res.json({ ok: true, audit: result });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/consolidation/modules', async (req, res) => {
    try {
      const result = await consolidation.architectureAuditor.scanModuleDirectories(svc);
      res.json({ ok: true, modules: result });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/consolidation/duplicates', async (req, res) => {
    try {
      const result = await consolidation.moduleDuplicationDetector.buildDuplicationReport({}, svc);
      res.json({ ok: true, duplicates: result });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/consolidation/routes', async (req, res) => {
    try {
      const result = await consolidation.routeRegistryConsolidator.buildRouteRegistryReport(svc);
      res.json({ ok: true, routes: result });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/consolidation/commands', async (req, res) => {
    try {
      const result = await consolidation.commandRegistryConsolidator.buildCommandRegistryReport(svc);
      res.json({ ok: true, commands: result });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/consolidation/capabilities', async (req, res) => {
    try {
      const result = await consolidation.capabilityRegistryConsolidator.buildCapabilityRegistryReport(svc);
      res.json({ ok: true, capabilities: result });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/consolidation/dashboard-registry', async (req, res) => {
    try {
      const result = await consolidation.dashboardRegistryAuditor.buildDashboardRegistryAuditReport(svc);
      res.json({ ok: true, dashboardRegistry: result });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/consolidation/docs', async (req, res) => {
    try {
      const result = await consolidation.docsConsistencyAuditor.buildDocsConsistencyReport(svc);
      res.json({ ok: true, docs: result });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/consolidation/tests', async (req, res) => {
    try {
      const result = await consolidation.testCoverageMapper.buildTestCoverageMap(svc);
      res.json({ ok: true, tests: result });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/consolidation/performance', async (req, res) => {
    try {
      const result = await consolidation.performanceBaselineChecker.buildPerformanceBaselineReport(svc);
      res.json({ ok: true, performance: result });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/consolidation/v2-roadmap', async (req, res) => {
    try {
      const roadmap = await consolidation.v2RoadmapGenerator.generateV2Roadmap(svc);
      consolidation.consolidationStore.setRoadmap(roadmap);
      res.json({ ok: true, roadmap });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/consolidation/report', async (req, res) => {
    try {
      const report = await consolidation.consolidationReportGenerator.generateConsolidationReport(svc);
      res.json({ ok: true, report });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });
}

module.exports = { registerConsolidationRoutes };

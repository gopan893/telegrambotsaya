'use strict';

const modelRouter = require('../model-router');

function registerModelRouterRoutes(router, services = {}) {
  const svc = { ...services, env: process.env };

  router.get('/model-router', async (req, res) => {
    try {
      res.json({ ok: true, status: 'Model Router routes active', endpoints: ['providers', 'health', 'simulate', 'capabilities', 'audit', 'benchmark', 'report'] });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/model-router/providers', async (req, res) => {
    try {
      const providers = await modelRouter.modelProviderRegistry.listProviders(req.query, svc);
      const safe = providers.map(p => ({ id: p.id, name: p.name, type: p.type, supportsVision: p.supportsVision, supportsTools: p.supportsTools, privacyLevel: p.privacyLevel, costTier: p.costTier }));
      res.json({ ok: true, providers: safe });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.post('/model-router/health', async (req, res) => {
    try {
      const health = await modelRouter.modelHealthChecker.checkAllModelProviders(svc);
      const report = modelRouter.modelHealthChecker.buildModelHealthReport(health, svc);
      res.json({ ok: true, health: report });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.post('/model-router/simulate', async (req, res) => {
    try {
      const decision = await modelRouter.modelRoutingDecisionEngine.selectModelRoute({ text: req.body?.text || '' }, req.body?.context || {}, svc);
      const explanation = modelRouter.modelRoutingDecisionEngine.explainModelRoute(decision, svc);
      res.json({ ok: true, decision, explanation });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/model-router/capabilities', async (req, res) => {
    try {
      const capabilities = await modelRouter.modelCapabilityRegistry.listCapabilities(req.query, svc);
      res.json({ ok: true, capabilities });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/model-router/audit', async (req, res) => {
    try {
      const audits = await modelRouter.modelRouterAudit.listModelRouterAudit(req.query, svc);
      res.json({ ok: true, audits });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.post('/model-router/benchmark', async (req, res) => {
    try {
      const scope = req.body?.scope || 'smoke';
      const benchmark = await modelRouter.modelBenchmarkRunner.runSafeModelBenchmark(scope, svc);
      if (benchmark.requiresApproval) return res.json({ ok: false, requiresApproval: true, message: 'High-cost benchmark requires approval.' });
      const report = modelRouter.modelBenchmarkRunner.buildBenchmarkReport(benchmark, svc);
      res.json({ ok: true, benchmark: report });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/model-router/report', async (req, res) => {
    try {
      const providers = await modelRouter.modelProviderRegistry.listProviders({}, svc);
      const health = await modelRouter.modelHealthChecker.checkAllModelProviders(svc);
      const healthReport = modelRouter.modelHealthChecker.buildModelHealthReport(health, svc);
      res.json({ ok: true, report: { providerCount: providers.length, health: healthReport } });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });
}

module.exports = { registerModelRouterRoutes };

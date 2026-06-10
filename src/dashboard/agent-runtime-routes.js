'use strict';

const utils = require('../agent-runtime/agent-runtime-utils');
const store = require('../agent-runtime/agent-runtime-store');
const profileMgr = require('../agent-runtime/agent-profile-manager');
const loadMonitor = require('../agent-runtime/agent-load-monitor');
const priorityMgr = require('../agent-runtime/agent-priority-manager');
const responseScorer = require('../agent-runtime/response-scorer');
const councilCost = require('../agent-runtime/council-cost-tracker');
const healthMon = require('../agent-runtime/agent-health-monitor');
const reportGen = require('../agent-runtime/agent-runtime-report-generator');
const modelRouter = require('../model-strategy/model-router');
const modelFallback = require('../model-strategy/model-fallback-chain');
const modelCost = require('../model-strategy/model-cost-tracker');
const modelLatency = require('../model-strategy/model-latency-monitor');
const modelQuality = require('../model-strategy/model-quality-tracker');
const privacyGuard = require('../model-strategy/privacy-routing-guard');
const budgetMgr = require('../model-strategy/budget-manager');
const benchmarkPlanner = require('../model-strategy/benchmark-planner');

function _sanitize(obj) {
  return utils.sanitizeForReport(obj);
}

function _authRequired(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) return next();
  if (req.query && req.query.token) {
    const env = req.app?.locals?.dashboardEnv || process.env;
    const adminToken = env.DASHBOARD_ADMIN_TOKEN || '';
    if (req.query.token === adminToken) return next();
  }
  return res.status(401).json({ ok: false, error: 'UNAUTHORIZED' });
}

function registerAgentRuntimeRoutes(app, services = {}) {
  app.get('/api/dashboard/agent-runtime', _authRequired, async (req, res) => {
    try {
      const agents = store.getAllAgents ? store.getAllAgents() : [];
      const latest = agents.length > 0 ? agents[agents.length - 1] : null;
      const sanitized = latest ? _sanitize({
        id: latest.id,
        name: latest.name,
        status: latest.status,
        profileStatus: latest.profileStatus,
        loadStatus: latest.loadStatus,
        healthStatus: latest.healthStatus,
        priorityStatus: latest.priorityStatus,
        createdAt: latest.createdAt,
        updatedAt: latest.updatedAt
      }) : null;
      res.json({ ok: true, status: latest ? latest.status : 'empty', data: sanitized });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/dashboard/agent-runtime/profile', _authRequired, async (req, res) => {
    try {
      const result = profileMgr.getAgentProfiles ? profileMgr.getAgentProfiles(services) : {};
      const safe = _sanitize(result);
      res.json({ ok: true, status: 'ready', data: safe });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/dashboard/agent-runtime/load', _authRequired, async (req, res) => {
    try {
      const result = loadMonitor.getLoadStatus ? loadMonitor.getLoadStatus(services) : {};
      const safe = _sanitize(result);
      res.json({ ok: true, status: 'ready', data: safe });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/dashboard/agent-runtime/prioritize', _authRequired, async (req, res) => {
    try {
      const input = req.body || {};
      const result = priorityMgr.prioritize ? priorityMgr.prioritize(input, services) : {};
      const safe = _sanitize(result);
      res.json({ ok: true, status: 'ready', data: safe, note: 'READ-ONLY — Prioritization analysis only.' });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/dashboard/agent-runtime/score-response', _authRequired, async (req, res) => {
    try {
      const input = req.body || {};
      const result = responseScorer.scoreResponse ? responseScorer.scoreResponse(input, services) : {};
      const safe = _sanitize(result);
      res.json({ ok: true, status: 'ready', data: safe, note: 'READ-ONLY — Scoring only.' });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/dashboard/agent-runtime/council-cost', _authRequired, async (req, res) => {
    try {
      const result = councilCost.getCouncilCostReport ? councilCost.getCouncilCostReport(services) : {};
      const safe = _sanitize(result);
      res.json({ ok: true, status: 'ready', data: safe });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/dashboard/agent-runtime/health', _authRequired, async (req, res) => {
    try {
      const result = healthMon.getAgentHealth ? healthMon.getAgentHealth(services) : {};
      const safe = _sanitize(result);
      res.json({ ok: true, status: 'ready', data: safe });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/dashboard/agent-runtime/model-route', _authRequired, async (req, res) => {
    try {
      const input = req.body || {};
      const result = modelRouter.routeModel ? modelRouter.routeModel(input, services) : {};
      const safe = _sanitize(result);
      res.json({ ok: true, status: 'ready', data: safe, note: 'READ-ONLY — Routing analysis only.' });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/dashboard/agent-runtime/model-fallback', _authRequired, async (req, res) => {
    try {
      const result = modelFallback.getFallbackChain ? modelFallback.getFallbackChain(services) : {};
      const safe = _sanitize(result);
      res.json({ ok: true, status: 'ready', data: safe });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/dashboard/agent-runtime/model-cost', _authRequired, async (req, res) => {
    try {
      const result = modelCost.getCostReport ? modelCost.getCostReport(services) : {};
      const safe = _sanitize(result);
      res.json({ ok: true, status: 'ready', data: safe });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/dashboard/agent-runtime/model-latency', _authRequired, async (req, res) => {
    try {
      const result = modelLatency.getLatencyReport ? modelLatency.getLatencyReport(services) : {};
      const safe = _sanitize(result);
      res.json({ ok: true, status: 'ready', data: safe });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/dashboard/agent-runtime/model-quality', _authRequired, async (req, res) => {
    try {
      const result = modelQuality.getQualityReport ? modelQuality.getQualityReport(services) : {};
      const safe = _sanitize(result);
      res.json({ ok: true, status: 'ready', data: safe });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/dashboard/agent-runtime/privacy-check', _authRequired, async (req, res) => {
    try {
      const input = req.body || {};
      const result = privacyGuard.checkPrivacyRouting ? privacyGuard.checkPrivacyRouting(input, services) : {};
      const safe = _sanitize(result);
      res.json({ ok: true, status: 'ready', data: safe, note: 'READ-ONLY — Privacy check only.' });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/dashboard/agent-runtime/budget', _authRequired, async (req, res) => {
    try {
      const result = budgetMgr.getBudgetReport ? budgetMgr.getBudgetReport(services) : {};
      const safe = _sanitize(result);
      res.json({ ok: true, status: 'ready', data: safe });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/dashboard/agent-runtime/benchmark-plan', _authRequired, async (req, res) => {
    try {
      const input = req.body || {};
      const result = benchmarkPlanner.buildBenchmarkPlan ? benchmarkPlanner.buildBenchmarkPlan(input, services) : {};
      const safe = _sanitize(result);
      res.json({ ok: true, status: 'ready', data: safe, note: 'PROPOSAL ONLY — No benchmark executed.' });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/dashboard/agent-runtime/report', _authRequired, async (req, res) => {
    try {
      const profileReport = profileMgr.getAgentProfiles ? profileMgr.getAgentProfiles(services) : {};
      const loadReport = loadMonitor.getLoadStatus ? loadMonitor.getLoadStatus(services) : {};
      const councilReport = councilCost.getCouncilCostReport ? councilCost.getCouncilCostReport(services) : {};
      const healthReport = healthMon.getAgentHealth ? healthMon.getAgentHealth(services) : {};
      const costReport = modelCost.getCostReport ? modelCost.getCostReport(services) : {};
      const latencyReport = modelLatency.getLatencyReport ? modelLatency.getLatencyReport(services) : {};
      const qualityReport = modelQuality.getQualityReport ? modelQuality.getQualityReport(services) : {};
      const budgetReport = budgetMgr.getBudgetReport ? budgetMgr.getBudgetReport(services) : {};
      const fullReport = reportGen.generateAgentRuntimeReport ? reportGen.generateAgentRuntimeReport({
        profiles: profileReport,
        load: loadReport,
        councilCost: councilReport,
        health: healthReport,
        modelCost: costReport,
        modelLatency: latencyReport,
        modelQuality: qualityReport,
        budget: budgetReport
      }, services) : {};
      const safe = _sanitize(fullReport);
      res.json({ ok: true, status: 'ready', data: safe });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });
}

module.exports = { registerAgentRuntimeRoutes };

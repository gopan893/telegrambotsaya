'use strict';

const store = require('../workflow-studio/workflow-store');
const parser = require('../workflow-studio/workflow-natural-parser');
const templates = require('../workflow-studio/workflow-template-library');
const builder = require('../workflow-studio/workflow-builder');
const validator = require('../workflow-studio/workflow-validator');
const riskSim = require('../workflow-studio/workflow-risk-simulator');
const approvalMapper = require('../workflow-studio/workflow-approval-mapper');
const dryRunner = require('../workflow-studio/workflow-dry-runner');
const proposalBridge = require('../workflow-studio/workflow-proposal-bridge');
const scheduler = require('../workflow-studio/workflow-scheduler-planner');
const runHistory = require('../workflow-studio/workflow-run-history');
const recipeBridge = require('../workflow-studio/workflow-recipe-bridge');
const deviceBridge = require('../workflow-studio/workflow-device-bridge');
const pluginBridge = require('../workflow-studio/workflow-plugin-bridge');
const ragBridge = require('../workflow-studio/workflow-rag-bridge');
const modelBridge = require('../workflow-studio/workflow-model-bridge');

function _sanitize(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const clean = { ...obj };
  delete clean.token;
  delete clean.secret;
  delete clean.password;
  delete clean.apiKey;
  return clean;
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

function registerWorkflowStudioRoutes(app, services = {}) {
  app.get('/api/dashboard/workflow-studio', _authRequired, async (req, res) => {
    try {
      const workflows = store.listWorkflows();
      const templateList = templates.listTemplates();
      res.json({ ok: true, status: 'ready', data: _sanitize({ workflowCount: workflows.length, templateCount: templateList.length }) });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/dashboard/workflow-studio/templates', _authRequired, async (req, res) => {
    try {
      const list = templates.listTemplates();
      res.json({ ok: true, status: 'ready', data: list });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/dashboard/workflow-studio/parse', _authRequired, async (req, res) => {
    try {
      const result = parser.parseNaturalLanguage(req.body?.input || '');
      res.json({ ok: true, status: 'parsed', data: _sanitize(result) });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/dashboard/workflow-studio/drafts', _authRequired, async (req, res) => {
    try {
      const drafts = store.listWorkflows({ status: 'draft' });
      res.json({ ok: true, status: 'ready', data: drafts.map(_sanitize) });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/dashboard/workflow-studio/drafts', _authRequired, async (req, res) => {
    try {
      const result = builder.createWorkflow(req.body || {});
      res.json({ ok: true, status: result.ok ? 'created' : 'error', data: _sanitize(result) });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/dashboard/workflow-studio/:id', _authRequired, async (req, res) => {
    try {
      const wf = store.getWorkflow(req.params.id);
      if (!wf) return res.status(404).json({ ok: false, error: 'Workflow not found' });
      res.json({ ok: true, status: 'ready', data: _sanitize(wf) });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/dashboard/workflow-studio/:id/update', _authRequired, async (req, res) => {
    try {
      const updated = store.updateWorkflow(req.params.id, req.body || {});
      if (!updated) return res.status(404).json({ ok: false, error: 'Workflow not found' });
      res.json({ ok: true, status: 'updated', data: _sanitize(updated) });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/dashboard/workflow-studio/:id/validate', _authRequired, async (req, res) => {
    try {
      const result = validator.getValidationReport(req.params.id);
      res.json({ ok: true, status: 'validated', data: _sanitize(result) });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/dashboard/workflow-studio/:id/simulate-risk', _authRequired, async (req, res) => {
    try {
      const result = riskSim.simulateRisk(req.params.id);
      res.json({ ok: true, status: 'simulated', data: _sanitize(result), note: 'READ-ONLY — Risk simulation only.' });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/dashboard/workflow-studio/:id/approval-map', _authRequired, async (req, res) => {
    try {
      const result = approvalMapper.buildApprovalMap(req.params.id);
      res.json({ ok: true, status: 'ready', data: _sanitize(result) });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/dashboard/workflow-studio/:id/dry-run', _authRequired, async (req, res) => {
    try {
      const result = dryRunner.dryRun(req.params.id);
      res.json({ ok: true, status: 'dry_run', data: _sanitize(result), note: 'READ-ONLY — No real actions executed.' });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/dashboard/workflow-studio/:id/proposal', _authRequired, async (req, res) => {
    try {
      const result = proposalBridge.createProposal({ workflowId: req.params.id, ...(req.body || {}) });
      res.json({ ok: true, status: 'proposal_created', data: _sanitize(result), note: 'PROPOSAL ONLY — No action executed.' });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/dashboard/workflow-studio/:id/schedule-plan', _authRequired, async (req, res) => {
    try {
      const result = scheduler.createSchedulePlan(req.params.id, req.query || {});
      res.json({ ok: true, status: 'ready', data: _sanitize(result) });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/dashboard/workflow-studio/:id/runs', _authRequired, async (req, res) => {
    try {
      const runs = runHistory.getRunHistory(req.params.id);
      const stats = runHistory.getRunStats(req.params.id);
      res.json({ ok: true, status: 'ready', data: _sanitize({ runs, stats }) });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/dashboard/workflow-studio/convert-recipe', _authRequired, async (req, res) => {
    try {
      const result = recipeBridge.convertRecipe(req.body || {});
      res.json({ ok: true, status: 'converted', data: _sanitize(result) });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/dashboard/workflow-studio/device-step', _authRequired, async (req, res) => {
    try {
      const result = deviceBridge.createDeviceStep(req.body || {});
      res.json({ ok: true, status: 'created', data: _sanitize(result) });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/dashboard/workflow-studio/plugin-step', _authRequired, async (req, res) => {
    try {
      const result = pluginBridge.createPluginStep(req.body || {});
      res.json({ ok: true, status: 'created', data: _sanitize(result) });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/dashboard/workflow-studio/rag-step', _authRequired, async (req, res) => {
    try {
      const result = ragBridge.createRagStep(req.body || {});
      res.json({ ok: true, status: 'created', data: _sanitize(result) });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.post('/api/dashboard/workflow-studio/model-step', _authRequired, async (req, res) => {
    try {
      const result = modelBridge.createModelStep(req.body || {});
      res.json({ ok: true, status: 'created', data: _sanitize(result) });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });

  app.get('/api/dashboard/workflow-studio/report', _authRequired, async (req, res) => {
    try {
      const workflows = store.listWorkflows();
      const templateList = templates.listTemplates();
      const allRuns = store.getRunHistory(null, 100);
      res.json({ ok: true, status: 'ready', data: _sanitize({ workflowCount: workflows.length, templateCount: templateList.length, recentRuns: allRuns.length }) });
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message });
    }
  });
}

module.exports = { registerWorkflowStudioRoutes };

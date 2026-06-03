'use strict';

const express = require('express');
const path = require('path');
const dashboardRoutes = require('./dashboard-routes');
const auth = require('./dashboard-auth');
const guards = require('./dashboard-guards');
const serializers = require('./dashboard-serializers');
const utils = require('./dashboard-utils');
const actions = require('./dashboard-actions');

function getCodingServices(services = {}) {
  return {
    storageManager: services.storageManager || null,
    codingWorkspace: services.codingWorkspace || null,
    logger: services.logger || services.log || console
  };
}

async function safeCall(fn, fallback) {
  try {
    return await fn();
  } catch (_) {
    return fallback;
  }
}

function registerCodingWorkspaceRoutes(app, services = {}) {
  const coding = require('../coding');
  const codingServices = getCodingServices(services);

  // GET /api/dashboard/coding-workspace
  app.get('/api/dashboard/coding-workspace', auth.requireAuth, async (req, res) => {
    try {
      const storageManager = codingServices.storageManager;
      const workspaces = storageManager
        ? await safeCall(() => storageManager.loadData(coding.STORAGE_KEYS.codingWorkspaces, []), [])
        : [];

      const sanitized = (workspaces || []).map(ws => ({
        id: ws.id,
        projectName: ws.projectName,
        repoProvider: ws.repoProvider,
        repoOwner: ws.repoOwner ? ws.repoOwner.slice(0, 3) + '***' : '',
        repoName: ws.repoName,
        defaultBranch: ws.defaultBranch,
        techStack: ws.techStack,
        status: ws.status,
        createdAt: ws.createdAt,
        updatedAt: ws.updatedAt
      }));

      return res.json({ ok: true, workspaces: sanitized });
    } catch (err) {
      return res.status(500).json({ ok: false, error: 'Failed to load coding workspaces' });
    }
  });

  // POST /api/dashboard/coding-workspace
  app.post('/api/dashboard/coding-workspace', auth.requireAuth, async (req, res) => {
    try {
      const storageManager = codingServices.storageManager;
      if (!storageManager) {
        return res.status(503).json({ ok: false, error: 'Storage not available' });
      }

      const workspace = await coding.updateRepoContext(req.body || {}, { storageManager });
      return res.json({ ok: true, workspace });
    } catch (err) {
      return res.status(500).json({ ok: false, error: 'Failed to create/update workspace' });
    }
  });

  // GET /api/dashboard/coding-workspace/requests
  app.get('/api/dashboard/coding-workspace/requests', auth.requireAuth, async (req, res) => {
    try {
      const storageManager = codingServices.storageManager;
      const requests = storageManager
        ? await safeCall(() => storageManager.loadData(coding.STORAGE_KEYS.codingRequests, []), [])
        : [];
      return res.json({ ok: true, requests: requests || [] });
    } catch (err) {
      return res.status(500).json({ ok: false, error: 'Failed to load requests' });
    }
  });

  // POST /api/dashboard/coding-workspace/requests/classify
  app.post('/api/dashboard/coding-workspace/requests/classify', auth.requireAuth, async (req, res) => {
    try {
      const { text } = req.body || {};
      if (!text) {
        return res.status(400).json({ ok: false, error: 'Missing text' });
      }
      const classification = coding.classifyRequest(text);
      return res.json({ ok: true, classification });
    } catch (err) {
      return res.status(500).json({ ok: false, error: 'Classification failed' });
    }
  });

  // POST /api/dashboard/coding-workspace/change-plan
  app.post('/api/dashboard/coding-workspace/change-plan', auth.requireAuth, async (req, res) => {
    try {
      const plan = coding.createCodeChangePlan(req.body || {}, {}, codingServices);
      return res.json({ ok: true, plan });
    } catch (err) {
      return res.status(500).json({ ok: false, error: 'Failed to create change plan' });
    }
  });

  // GET /api/dashboard/coding-workspace/change-plans
  app.get('/api/dashboard/coding-workspace/change-plans', auth.requireAuth, async (req, res) => {
    try {
      const storageManager = codingServices.storageManager;
      const plans = storageManager
        ? await safeCall(() => storageManager.loadData(coding.STORAGE_KEYS.codingChangePlans, []), [])
        : [];
      return res.json({ ok: true, plans: plans || [] });
    } catch (err) {
      return res.status(500).json({ ok: false, error: 'Failed to load change plans' });
    }
  });

  // GET /api/dashboard/coding-workspace/change-plans/:id
  app.get('/api/dashboard/coding-workspace/change-plans/:id', auth.requireAuth, async (req, res) => {
    try {
      const storageManager = codingServices.storageManager;
      if (!storageManager) {
        return res.status(503).json({ ok: false, error: 'Storage not available' });
      }
      const plans = await safeCall(() => storageManager.loadData(coding.STORAGE_KEYS.codingChangePlans, []), []);
      const plan = (plans || []).find(p => p.id === req.params.id);
      if (!plan) {
        return res.status(404).json({ ok: false, error: 'Plan not found' });
      }
      return res.json({ ok: true, plan });
    } catch (err) {
      return res.status(500).json({ ok: false, error: 'Failed to load plan' });
    }
  });

  // POST /api/dashboard/coding-workspace/change-plans/:id/risk-review
  app.post('/api/dashboard/coding-workspace/change-plans/:id/risk-review', auth.requireAuth, async (req, res) => {
    try {
      const storageManager = codingServices.storageManager;
      if (!storageManager) {
        return res.status(503).json({ ok: false, error: 'Storage not available' });
      }
      const plans = await safeCall(() => storageManager.loadData(coding.STORAGE_KEYS.codingChangePlans, []), []);
      const plan = (plans || []).find(p => p.id === req.params.id);
      if (!plan) {
        return res.status(404).json({ ok: false, error: 'Plan not found' });
      }
      const riskReview = coding.buildRiskReviewSummary(plan, codingServices);
      return res.json({ ok: true, riskReview });
    } catch (err) {
      return res.status(500).json({ ok: false, error: 'Risk review failed' });
    }
  });

  // POST /api/dashboard/coding-workspace/change-plans/:id/test-plan
  app.post('/api/dashboard/coding-workspace/change-plans/:id/test-plan', auth.requireAuth, async (req, res) => {
    try {
      const storageManager = codingServices.storageManager;
      if (!storageManager) {
        return res.status(503).json({ ok: false, error: 'Storage not available' });
      }
      const plans = await safeCall(() => storageManager.loadData(coding.STORAGE_KEYS.codingChangePlans, []), []);
      const plan = (plans || []).find(p => p.id === req.params.id);
      if (!plan) {
        return res.status(404).json({ ok: false, error: 'Plan not found' });
      }
      const testPlan = coding.generateTestPlan(plan, codingServices);
      return res.json({ ok: true, testPlan });
    } catch (err) {
      return res.status(500).json({ ok: false, error: 'Test plan generation failed' });
    }
  });

  // POST /api/dashboard/coding-workspace/change-plans/:id/codex-prompt
  app.post('/api/dashboard/coding-workspace/change-plans/:id/codex-prompt', auth.requireAuth, async (req, res) => {
    try {
      const storageManager = codingServices.storageManager;
      if (!storageManager) {
        return res.status(503).json({ ok: false, error: 'Storage not available' });
      }
      const plans = await safeCall(() => storageManager.loadData(coding.STORAGE_KEYS.codingChangePlans, []), []);
      const plan = (plans || []).find(p => p.id === req.params.id);
      if (!plan) {
        return res.status(404).json({ ok: false, error: 'Plan not found' });
      }
      const testPlan = coding.generateTestPlan(plan, codingServices);
      const riskReview = coding.buildRiskReviewSummary(plan, codingServices);
      const prompt = coding.generateCodexPrompt(plan, testPlan, riskReview, codingServices);
      return res.json({ ok: true, prompt });
    } catch (err) {
      return res.status(500).json({ ok: false, error: 'Codex prompt generation failed' });
    }
  });

  // POST /api/dashboard/coding-workspace/change-plans/:id/github-issue-proposal
  app.post('/api/dashboard/coding-workspace/change-plans/:id/github-issue-proposal', auth.requireAuth, async (req, res) => {
    try {
      const storageManager = codingServices.storageManager;
      if (!storageManager) {
        return res.status(503).json({ ok: false, error: 'Storage not available' });
      }
      const plans = await safeCall(() => storageManager.loadData(coding.STORAGE_KEYS.codingChangePlans, []), []);
      const plan = (plans || []).find(p => p.id === req.params.id);
      if (!plan) {
        return res.status(404).json({ ok: false, error: 'Plan not found' });
      }

      // Must run Evaluation v2 first
      const result = await coding.createGithubProposalAfterEvaluation(plan, 'issue', codingServices);

      if (!result.success) {
        return res.status(400).json({
          ok: false,
          error: result.reason || 'Proposal blocked',
          evaluationResult: result.evaluationResult,
          errors: result.errors,
          message: 'GitHub proposal blocked. Evaluation v2 gate failed or approval required.'
        });
      }

      return res.json({
        ok: true,
        proposal: result.proposal,
        message: result.message,
        requiresExecutorApproval: true
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: 'GitHub issue proposal failed' });
    }
  });

  // POST /api/dashboard/coding-workspace/change-plans/:id/github-pr-proposal
  app.post('/api/dashboard/coding-workspace/change-plans/:id/github-pr-proposal', auth.requireAuth, async (req, res) => {
    try {
      const storageManager = codingServices.storageManager;
      if (!storageManager) {
        return res.status(503).json({ ok: false, error: 'Storage not available' });
      }
      const plans = await safeCall(() => storageManager.loadData(coding.STORAGE_KEYS.codingChangePlans, []), []);
      const plan = (plans || []).find(p => p.id === req.params.id);
      if (!plan) {
        return res.status(404).json({ ok: false, error: 'Plan not found' });
      }

      const result = await coding.createGithubProposalAfterEvaluation(plan, 'pr', codingServices);

      if (!result.success) {
        return res.status(400).json({
          ok: false,
          error: result.reason || 'Proposal blocked',
          evaluationResult: result.evaluationResult,
          errors: result.errors,
          message: 'GitHub PR proposal blocked. Evaluation v2 gate failed or approval required.'
        });
      }

      return res.json({
        ok: true,
        proposal: result.proposal,
        message: result.message,
        requiresExecutorApproval: true
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: 'GitHub PR proposal failed' });
    }
  });

  // GET /api/dashboard/coding-workspace/tasks
  app.get('/api/dashboard/coding-workspace/tasks', auth.requireAuth, async (req, res) => {
    try {
      const storageManager = codingServices.storageManager;
      const tasks = storageManager
        ? await safeCall(() => storageManager.loadData(coding.STORAGE_KEYS.codingTasks, []), [])
        : [];
      return res.json({ ok: true, tasks: tasks || [] });
    } catch (err) {
      return res.status(500).json({ ok: false, error: 'Failed to load tasks' });
    }
  });

  // POST /api/dashboard/coding-workspace/tasks
  app.post('/api/dashboard/coding-workspace/tasks', auth.requireAuth, async (req, res) => {
    try {
      const task = coding.createCodingTask(req.body || {}, codingServices);
      return res.json({ ok: true, task });
    } catch (err) {
      return res.status(500).json({ ok: false, error: 'Failed to create task' });
    }
  });
}

module.exports = {
  registerCodingWorkspaceRoutes,
  getCodingServices
};

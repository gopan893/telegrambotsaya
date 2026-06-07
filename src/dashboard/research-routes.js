'use strict';

const express = require('express');
const research = require('../research');
const guards = require('./dashboard-guards');
const workspaceRoutes = require('./workspace-routes');

function getActor(req, services = {}) {
  return workspaceRoutes.getActorId(req, services) || String(req.body?.actorId || req.query?.actorId || services.actorId || 'dashboard-admin');
}

function getWorkspace(req, services = {}) {
  return String(req.body?.workspaceId || req.query?.workspaceId || services.workspaceId || 'default').trim() || 'default';
}

function getUser(req, services = {}) {
  return guards.validateUserId(req.body?.userId || req.query?.userId || services.userId || services.env?.OWNER_CHAT_ID || getActor(req, services)) || getActor(req, services);
}

function buildServices(req, services = {}) {
  return {
    ...services,
    actorId: getActor(req, services),
    userId: getUser(req, services),
    workspaceId: getWorkspace(req, services),
    actorType: 'dashboard',
    researchSystem: research,
    ip: req.ip || req.headers['x-forwarded-for'] || '',
    userAgent: req.headers['user-agent'] || ''
  };
}

function route(handler) {
  return async (req, res) => {
    try {
      return await handler(req, res);
    } catch (err) {
      return guards.safeDashboardResponse(res, {
        ok: false,
        error: 'RESEARCH_ROUTE_FAILED',
        message: err?.message || 'Research module unavailable'
      }, 200);
    }
  };
}

function registerResearchRoutes(router, services = {}) {
  const dr = express.Router();

  dr.get('/', route(async (req, res) => {
    const runtime = buildServices(req, services);
    const [tasks, activity, docsGaps] = await Promise.all([
      research.researchTaskPlanner.listResearchTasks({ workspaceId: runtime.workspaceId, limit: req.query.limit || 20 }, runtime),
      research.researchReportGenerator.generateResearchActivitySummary({ workspaceId: runtime.workspaceId, limit: 20 }, runtime),
      research.researchReportGenerator.generateDocumentationGapReport(runtime)
    ]);
    return guards.safeDashboardResponse(res, { ok: true, tasks, activity, docsGaps });
  }));

  dr.get('/tasks', route(async (req, res) => {
    const runtime = buildServices(req, services);
    const tasks = await research.researchTaskPlanner.listResearchTasks({
      workspaceId: runtime.workspaceId,
      userId: req.query.userId || '',
      status: req.query.status || '',
      scope: req.query.scope || '',
      limit: req.query.limit || 50
    }, runtime);
    return guards.safeDashboardResponse(res, { ok: true, items: tasks });
  }));

  dr.post('/tasks', route(async (req, res) => {
    const runtime = buildServices(req, services);
    const result = await research.researchTaskPlanner.createResearchTask({
      ...(req.body || {}),
      workspaceId: runtime.workspaceId,
      userId: getUser(req, services)
    }, runtime);
    return guards.safeDashboardResponse(res, result, result.ok ? 200 : (result.status || 400));
  }));

  dr.get('/tasks/:id', route(async (req, res) => {
    const runtime = buildServices(req, services);
    const task = await research.researchTaskPlanner.getResearchTask(req.params.id, runtime);
    return guards.safeDashboardResponse(res, task ? { ok: true, task } : { ok: false, reason: 'RESEARCH_TASK_NOT_FOUND' }, task ? 200 : 404);
  }));

  dr.post('/tasks/:id/collect', route(async (req, res) => {
    const runtime = buildServices(req, services);
    const result = await research.sourceCollector.collectSourcesForTask(req.params.id, runtime);
    return guards.safeDashboardResponse(res, result, result.ok ? 200 : (result.status || 400));
  }));

  dr.post('/tasks/:id/analyze', route(async (req, res) => {
    const runtime = buildServices(req, services);
    const collected = await research.sourceCollector.collectSourcesForTask(req.params.id, runtime);
    if (!collected.ok) return guards.safeDashboardResponse(res, collected, collected.status || 400);
    const evidence = await research.evidenceExtractor.buildEvidencePack(collected.task, null, runtime);
    if (!evidence.ok) return guards.safeDashboardResponse(res, evidence, evidence.status || 400);
    const summary = await research.researchSummarizer.summarizeResearchTask(req.params.id, runtime);
    return guards.safeDashboardResponse(res, summary, summary.ok ? 200 : (summary.status || 400));
  }));

  dr.get('/tasks/:id/evidence', route(async (req, res) => {
    const runtime = buildServices(req, services);
    const task = await research.researchTaskPlanner.getResearchTask(req.params.id, runtime);
    return guards.safeDashboardResponse(res, task ? { ok: true, evidence: task.evidence || [], evidencePack: task.evidencePack || {} } : { ok: false, reason: 'RESEARCH_TASK_NOT_FOUND' }, task ? 200 : 404);
  }));

  dr.get('/tasks/:id/report', route(async (req, res) => {
    const runtime = buildServices(req, services);
    const result = await research.researchReportGenerator.generateResearchReport(req.params.id, runtime);
    return guards.safeDashboardResponse(res, result, result.ok ? 200 : (result.status || 400));
  }));

  dr.post('/tasks/:id/link-knowledge', route(async (req, res) => {
    const runtime = buildServices(req, services);
    const result = await research.researchKnowledgeLinker.linkResearchToKnowledgeGraph(req.params.id, runtime);
    return guards.safeDashboardResponse(res, result, result.ok ? 200 : (result.status || 400));
  }));

  dr.get('/docs/gaps', route(async (req, res) => {
    const runtime = buildServices(req, services);
    const result = await research.researchReportGenerator.generateDocumentationGapReport(runtime);
    return guards.safeDashboardResponse(res, result);
  }));

  dr.post('/docs/draft', route(async (req, res) => {
    const runtime = buildServices(req, services);
    const planResult = research.documentationAgent.createDocumentationPlan({ ...(req.body || {}), workspaceId: runtime.workspaceId, userId: runtime.userId }, runtime);
    const draft = research.documentationDraftGenerator.generateDocumentationDraft(planResult.plan, runtime);
    return guards.safeDashboardResponse(res, { ok: true, plan: planResult.plan, ...draft });
  }));

  dr.post('/docs/update-plan', route(async (req, res) => {
    const runtime = buildServices(req, services);
    const draft = req.body?.draft || req.body || {};
    const result = await research.documentationUpdatePlanner.createDocumentationUpdatePlan(draft, runtime);
    return guards.safeDashboardResponse(res, result, result.ok ? 200 : (result.status || 400));
  }));

  dr.post('/docs/proposal', route(async (req, res) => {
    const runtime = buildServices(req, services);
    const updatePlan = req.body?.updatePlan || req.body || {};
    const result = await research.documentationUpdatePlanner.createDocsUpdateProposal(updatePlan, runtime);
    return guards.safeDashboardResponse(res, result, result.ok ? 200 : (result.status || 400));
  }));

  router.use('/research', dr);
}

module.exports = {
  registerResearchRoutes
};


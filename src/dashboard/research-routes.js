'use strict';

const express = require('express');
const research = require('../research');

function buildServices(req, services = {}) {
  return { ...services, actorId: req.query?.actorId || services.actorId || 'dashboard-admin', workspaceId: req.query?.workspaceId || 'default' };
}

function registerResearchRoutes(router, services = {}) {
  router.get('/research', async (req, res) => {
    try {
      const svc = buildServices(req, services);
      const tasks = await research.researchTaskManager.listResearchTasks({}, svc);
      res.json({ ok: true, tasks });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.post('/research/tasks', async (req, res) => {
    try {
      const svc = buildServices(req, services);
      const task = await research.researchTaskManager.createResearchTask(req.body, svc);
      res.json({ ok: true, task });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/research/tasks', async (req, res) => {
    try {
      const svc = buildServices(req, services);
      const tasks = await research.researchTaskManager.listResearchTasks(req.query, svc);
      res.json({ ok: true, tasks });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/research/tasks/:id', async (req, res) => {
    try {
      const svc = buildServices(req, services);
      const task = await research.researchTaskManager.getResearchTask(req.params.id, svc);
      if (!task) return res.status(404).json({ ok: false, error: 'Task not found' });
      res.json({ ok: true, task });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.post('/research/tasks/:id/summarize', async (req, res) => {
    try {
      const svc = buildServices(req, services);
      const task = await research.researchTaskManager.getResearchTask(req.params.id, svc);
      if (!task) return res.status(404).json({ ok: false, error: 'Task not found' });
      const summary = research.researchSummarizer.generateResearchSummary ? await research.researchSummarizer.generateResearchSummary(task, svc) : { note: 'Summary available via existing summarizer' };
      res.json({ ok: true, summary });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.post('/research/tasks/:id/compare', async (req, res) => {
    try {
      const svc = buildServices(req, services);
      const matrix = research.comparisonMatrixGenerator.generateComparisonMatrix({ options: req.body?.options || [] }, svc);
      res.json({ ok: true, matrix });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.post('/research/tasks/:id/implementation-note', async (req, res) => {
    try {
      const svc = buildServices(req, services);
      const note = research.implementationNoteGenerator.generateImplementationNote(req.params.id, svc);
      res.json({ ok: true, note });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.post('/research/tasks/:id/prompt', async (req, res) => {
    try {
      const svc = buildServices(req, services);
      const target = (req.body?.target || 'codex').toLowerCase();
      const generators = { codex: research.researchPromptGenerator.generateCodexPromptFromResearch, opencode: research.researchPromptGenerator.generateOpenCodePromptFromResearch, hermes: research.researchPromptGenerator.generateHermesPromptFromResearch };
      const gen = generators[target] || generators.codex;
      const prompt = gen(req.params.id, svc);
      res.json({ ok: true, prompt });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.post('/research/tasks/:id/proposal', async (req, res) => {
    try {
      const svc = buildServices(req, services);
      const plan = await research.researchProposalBridge.createResearchActionPlan(req.params.id, svc);
      const proposal = plan ? await research.researchProposalBridge.createResearchExecutorProposal(plan, svc) : null;
      res.json({ ok: !!proposal, plan, proposal });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });
}

module.exports = { registerResearchRoutes };

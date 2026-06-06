'use strict';

const express = require('express');
const guards = require('./dashboard-guards');
const auditLog = require('./audit-log');
const knowledge = require('../knowledge');

function getActor(req) {
  return String(req.body?.actorId || req.query?.actorId || req.headers['x-dashboard-actor'] || 'dashboard').slice(0, 80);
}

function getWorkspace(req) {
  return String(req.body?.workspaceId || req.query?.workspaceId || 'default').slice(0, 100);
}

function getServices(req, services) {
  return {
    ...services,
    workspaceId: getWorkspace(req),
    actorId: getActor(req)
  };
}

function tryLoadModule() {
  try {
    return knowledge;
  } catch (e) {
    return null;
  }
}

function recordAudit(safe, entry) {
  if (safe?.auditLog?.record) {
    try { safe.auditLog.record(entry); } catch (_) {}
  }
}

function registerKnowledgeRoutes(router, services = {}) {
  const dr = express.Router();
  const safe = services || {};
  const mod = tryLoadModule();

  function moduleGuard(orBlock) {
    if (!mod) {
      if (orBlock) return orBlock();
      return { ok: false, error: 'KNOWLEDGE_MODULE_UNAVAILABLE' };
    }
    return null;
  }

  dr.get('/', async (req, res) => {
    const block = moduleGuard(() => guards.safeDashboardResponse(res, { ok: false, error: 'Knowledge module not loaded' }, 503));
    if (block) return;
    const ws = getWorkspace(req);
    const summary = knowledge.knowledgeReportGenerator.buildKnowledgeGraphSummary(ws, services);
    const nodes = knowledge.knowledgeGraphStore.listKnowledgeNodes({ workspaceId: ws, limit: 50 }, services);
    const decisionReport = knowledge.knowledgeReportGenerator.generateDecisionReport({}, services);
    const stats = knowledge.knowledgeGraphStore.stats();
    return guards.safeDashboardResponse(res, { ok: true, summary, nodes, decisionReport, stats });
  });

  dr.get('/search', async (req, res) => {
    const block = moduleGuard();
    if (block) return guards.safeDashboardResponse(res, block, 503);
    const query = String(req.query.q || req.query.query || '').slice(0, 200);
    const result = knowledge.knowledgeGraphStore.searchKnowledgeGraph(query, services);
    return guards.safeDashboardResponse(res, { ok: true, ...result });
  });

  dr.get('/nodes', async (req, res) => {
    const block = moduleGuard();
    if (block) return guards.safeDashboardResponse(res, block, 503);
    const filters = {
      type: req.query.type || '',
      status: req.query.status || 'active',
      source: req.query.source || '',
      tag: req.query.tag || '',
      search: req.query.search || '',
      workspaceId: getWorkspace(req),
      limit: guards.validateLimit(req.query.limit, 50, 200)
    };
    const nodes = knowledge.knowledgeGraphStore.listKnowledgeNodes(filters, services);
    return guards.safeDashboardResponse(res, { ok: true, nodes });
  });

  dr.get('/nodes/:id', async (req, res) => {
    const block = moduleGuard();
    if (block) return guards.safeDashboardResponse(res, block, 503);
    const node = knowledge.knowledgeGraphStore.getKnowledgeNode(String(req.params.id || ''), services);
    if (!node) return guards.safeDashboardResponse(res, { ok: false, error: 'NODE_NOT_FOUND' }, 404);
    return guards.safeDashboardResponse(res, { ok: true, node });
  });

  dr.get('/nodes/:id/graph', async (req, res) => {
    const block = moduleGuard();
    if (block) return guards.safeDashboardResponse(res, block, 503);
    const depth = Math.max(0, Math.min(3, parseInt(req.query.depth, 10) || 1));
    const graph = knowledge.knowledgeGraphStore.getGraphAroundNode(String(req.params.id || ''), depth, services);
    if (!graph.ok) return guards.safeDashboardResponse(res, graph, 404);
    return guards.safeDashboardResponse(res, { ok: true, ...graph });
  });

  dr.get('/decisions', async (req, res) => {
    const block = moduleGuard();
    if (block) return guards.safeDashboardResponse(res, block, 503);
    const query = String(req.query.q || '').slice(0, 200);
    const decisions = query
      ? knowledge.decisionMemoryManager.searchDecisionMemory(query, services)
      : knowledge.knowledgeGraphStore.listKnowledgeNodes({ type: 'decision', status: 'active', limit: 200 }, services);
    return guards.safeDashboardResponse(res, { ok: true, decisions });
  });

  dr.post('/ingest', async (req, res) => {
    const block = moduleGuard();
    if (block) return guards.safeDashboardResponse(res, block, 503);
    const body = req.body || {};
    if (!body.type) return guards.safeDashboardResponse(res, { ok: false, error: 'TYPE_REQUIRED' }, 400);
    const result = knowledge.projectKnowledgeIngestor.ingestManualKnowledge({
      type: body.type,
      title: body.title,
      summary: body.summary,
      tags: body.tags,
      source: body.source || 'dashboard',
      sensitivity: body.sensitivity || 'internal',
      confidence: body.confidence,
      metadata: body.metadata,
      allowConflict: body.allowConflict === true
    }, services);
    return guards.safeDashboardResponse(res, result.ok ? result : { ok: false, error: result.error, safeSummary: result.safeSummary, report: result.report }, result.ok ? 200 : 400);
  });

  dr.post('/context-pack', async (req, res) => {
    const block = moduleGuard();
    if (block) return guards.safeDashboardResponse(res, block, 503);
    const query = String(req.body?.query || '').slice(0, 200);
    const pack = knowledge.contextRetrievalEngine.buildContextPack(query, req.body || {}, services);
    return guards.safeDashboardResponse(res, { ok: true, pack });
  });

  dr.post('/safety-check', async (req, res) => {
    const block = moduleGuard();
    if (block) return guards.safeDashboardResponse(res, block, 503);
    const candidate = req.body?.candidate || req.body || {};
    const report = knowledge.memorySafetyGate.buildMemorySafetyReport(candidate, services);
    recordAudit(safe, { type: 'memory_safety_check', source: 'dashboard', ok: report.safeToStore });
    return guards.safeDashboardResponse(res, { ok: true, report });
  });

  dr.get('/duplicates', async (req, res) => {
    const block = moduleGuard();
    if (block) return guards.safeDashboardResponse(res, block, 503);
    const candidate = req.query.candidate ? (() => {
      try { return JSON.parse(req.query.candidate); } catch (_) { return {}; }
    })() : {};
    const report = knowledge.memoryDeduplicator.buildDeduplicationReport(candidate, services);
    return guards.safeDashboardResponse(res, { ok: true, report });
  });

  dr.get('/stale', async (req, res) => {
    const block = moduleGuard();
    if (block) return guards.safeDashboardResponse(res, block, 503);
    const plan = knowledge.memoryStalenessReviewer.createMemoryCleanupPlan({}, services);
    return guards.safeDashboardResponse(res, { ok: true, plan });
  });

  dr.post('/archive', async (req, res) => {
    const block = moduleGuard();
    if (block) return guards.safeDashboardResponse(res, block, 503);
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.slice(0, 200) : [];
    if (!ids.length) return guards.safeDashboardResponse(res, { ok: false, error: 'IDS_REQUIRED' }, 400);
    const result = knowledge.memoryStalenessReviewer.archiveStaleKnowledge(ids, services);
    recordAudit(safe, { type: 'knowledge_archive', source: 'dashboard', count: result.archived?.length || 0 });
    return guards.safeDashboardResponse(res, { ok: true, ...result });
  });

  dr.get('/docs-status', async (req, res) => {
    const block = moduleGuard();
    if (block) return guards.safeDashboardResponse(res, block, 503);
    const suggestion = knowledge.documentationIntelligence.suggestDocumentationUpdates(services);
    return guards.safeDashboardResponse(res, { ok: true, ...suggestion });
  });

  dr.get('/report', async (req, res) => {
    const block = moduleGuard();
    if (block) return guards.safeDashboardResponse(res, block, 503);
    const ws = getWorkspace(req);
    const report = {
      graph: knowledge.knowledgeReportGenerator.buildKnowledgeGraphSummary(ws, services),
      decisions: knowledge.knowledgeReportGenerator.generateDecisionReport({}, services),
      incidents: knowledge.knowledgeReportGenerator.generateIncidentKnowledgeReport({}, services),
      governance: knowledge.knowledgeReportGenerator.generateMemoryGovernanceReport({}, services),
      staleness: knowledge.memoryStalenessReviewer.createMemoryCleanupPlan({}, services),
      generatedAt: new Date().toISOString()
    };
    return guards.safeDashboardResponse(res, { ok: true, report });
  });

  router.use('/knowledge', dr);
}

module.exports = { registerKnowledgeRoutes };

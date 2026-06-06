'use strict';

const store = require('./knowledge-graph-store');
const utils = require('./knowledge-utils');

function buildKnowledgeGraphSummary(workspaceId, services = {}) {
  const all = store.listKnowledgeNodes({ workspaceId, limit: 1000 }, services);
  const active = all.filter(n => n.status === 'active');
  const byType = active.reduce((acc, n) => { acc[n.type] = (acc[n.type] || 0) + 1; return acc; }, {});
  const decisions = active.filter(n => n.type === 'decision');
  const risks = active.filter(n => n.type === 'risk');
  const incidents = active.filter(n => n.type === 'incident');
  const deploys = active.filter(n => n.type === 'deploy');
  const proposals = active.filter(n => n.type === 'proposal');
  const edges = store.listKnowledgeEdges({ workspaceId, limit: 5000 }, services);
  return {
    workspaceId: workspaceId || 'default',
    totalNodes: all.length,
    activeNodes: active.length,
    archivedNodes: all.length - active.length,
    totalEdges: edges.length,
    byType,
    counts: {
      decisions: decisions.length,
      risks: risks.length,
      incidents: incidents.length,
      deploys: deploys.length,
      proposals: proposals.length
    },
    generatedAt: utils.nowIso()
  };
}

function generateProjectKnowledgeReport(projectId, services = {}) {
  const project = store.getKnowledgeNode(projectId, services);
  if (!project) return { ok: false, error: 'PROJECT_NOT_FOUND' };
  const allEdges = store.listKnowledgeEdges({ limit: 1000 }, services).filter(e => e.fromNodeId === projectId || e.toNodeId === projectId);
  const relatedIds = new Set(allEdges.map(e => e.fromNodeId === projectId ? e.toNodeId : e.fromNodeId));
  const related = store.listKnowledgeNodes({ limit: 1000 }, services).filter(n => relatedIds.has(n.id));
  return {
    ok: true,
    project,
    keyDecisions: related.filter(n => n.type === 'decision').slice(0, 20),
    activeConstraints: related.filter(n => (n.tags || []).includes('core') || (n.tags || []).includes('approval')),
    knownRisks: related.filter(n => n.type === 'risk').slice(0, 20),
    relatedIncidents: related.filter(n => n.type === 'incident').slice(0, 20),
    relatedDeploys: related.filter(n => n.type === 'deploy' || n.type === 'rollback').slice(0, 20),
    relatedProposals: related.filter(n => n.type === 'proposal').slice(0, 20),
    docsStatus: 'see /api/dashboard/knowledge/docs-status',
    generatedAt: utils.nowIso()
  };
}

function generatePhaseKnowledgeReport(phaseNumber, services = {}) {
  const phases = store.listKnowledgeNodes({ type: 'phase', status: 'active', limit: 200 }, services);
  const matched = phases.filter(p =>
    String(p.title || '').toLowerCase().includes(`phase ${phaseNumber}`) ||
    String(p.sourceId || '').includes(String(phaseNumber))
  );
  const phaseIds = new Set(matched.map(n => n.id));
  const related = store.listKnowledgeNodes({ limit: 1000 }, services).filter(n => {
    if (phaseIds.has(n.id)) return false;
    return store.listKnowledgeEdges({ nodeId: n.id, limit: 100 }, services).some(e => phaseIds.has(e.fromNodeId) || phaseIds.has(e.toNodeId));
  });
  return {
    ok: true,
    phase: phaseNumber,
    phaseNodes: matched,
    keyDecisions: related.filter(n => n.type === 'decision').slice(0, 20),
    knownRisks: related.filter(n => n.type === 'risk').slice(0, 20),
    relatedIncidents: related.filter(n => n.type === 'incident').slice(0, 20),
    generatedAt: utils.nowIso()
  };
}

function generateDecisionReport(filters = {}, services = {}) {
  const decisions = store.listKnowledgeNodes({ type: 'decision', status: 'active', limit: 500 }, services);
  return {
    total: decisions.length,
    protected: decisions.filter(d => utils.isProtectedDecisionTitle(d.title)).length,
    custom: decisions.filter(d => !utils.isProtectedDecisionTitle(d.title)).length,
    bySource: decisions.reduce((acc, d) => { acc[d.source || 'unknown'] = (acc[d.source || 'unknown'] || 0) + 1; return acc; }, {}),
    generatedAt: utils.nowIso()
  };
}

function generateIncidentKnowledgeReport(filters = {}, services = {}) {
  const incidents = store.listKnowledgeNodes({ type: 'incident', status: 'active', limit: 200 }, services);
  return {
    total: incidents.length,
    bySeverity: incidents.reduce((acc, i) => {
      const sev = (i.tags || []).find(t => ['low', 'medium', 'high', 'critical'].includes(t)) || 'unknown';
      acc[sev] = (acc[sev] || 0) + 1;
      return acc;
    }, {}),
    recent: incidents.slice(0, 10),
    generatedAt: utils.nowIso()
  };
}

function generateMemoryGovernanceReport(filters = {}, services = {}) {
  const all = store.listKnowledgeNodes({ status: 'active', limit: 1000 }, services);
  return {
    totalActive: all.length,
    sensitivity: all.reduce((acc, n) => { acc[n.sensitivity || 'internal'] = (acc[n.sensitivity || 'internal'] || 0) + 1; return acc; }, {}),
    redactedSafe: all.filter(n => n.summary && !n.summary.includes(utils.REDACTION_PLACEHOLDER)).length,
    protectedDecisions: all.filter(n => utils.isProtectedDecisionTitle(n.title)).length,
    generatedAt: utils.nowIso()
  };
}

module.exports = {
  buildKnowledgeGraphSummary,
  generateProjectKnowledgeReport,
  generatePhaseKnowledgeReport,
  generateDecisionReport,
  generateIncidentKnowledgeReport,
  generateMemoryGovernanceReport
};

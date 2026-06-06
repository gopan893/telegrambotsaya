'use strict';

const store = require('./knowledge-graph-store');
const utils = require('./knowledge-utils');

const DEFAULT_HARD_LIMIT = 25;
const DEFAULT_HARD_LIMIT_NODES = 30;

function filterRelevant(nodes = [], query) {
  if (!query) return nodes;
  const q = String(query).toLowerCase();
  return nodes.filter(n =>
    (n.title || '').toLowerCase().includes(q) ||
    (n.summary || '').toLowerCase().includes(q) ||
    (n.tags || []).some(t => t.toLowerCase().includes(q))
  );
}

function buildContextPack(query, options = {}, services = {}) {
  const q = String(query || '').trim();
  const allNodes = store.listKnowledgeNodes({ status: 'active', limit: 500 }, services);
  const matched = filterRelevant(allNodes, q).slice(0, DEFAULT_HARD_LIMIT_NODES);
  const matchedIds = new Set(matched.map(n => n.id));
  const allEdges = store.listKnowledgeEdges({ limit: 1000 }, services);
  const selectedEdges = allEdges.filter(e => matchedIds.has(e.fromNodeId) && matchedIds.has(e.toNodeId)).slice(0, 100);
  const summaries = matched.slice(0, 10).map(n => `${n.title}: ${String(n.summary || '').slice(0, 200)}`);
  const decisions = matched.filter(n => n.type === 'decision').map(n => ({
    id: n.id, title: n.title, summary: n.summary
  }));
  const risks = matched.filter(n => n.type === 'risk').map(n => ({
    id: n.id, title: n.title, summary: n.summary
  }));
  const constraints = matched
    .filter(n => (n.tags || []).includes('core') || (n.tags || []).includes('approval'))
    .map(n => n.title);
  const knownMissing = q && matched.length === 0 ? [q] : [];
  const confidence = matched.length === 0
    ? 0
    : Math.round((matched.reduce((acc, n) => acc + (n.confidence || 0), 0) / matched.length) * 100);
  return {
    query: q,
    selectedNodes: matched.map(n => ({
      id: n.id, type: n.type, title: n.title, summary: n.summary, confidence: n.confidence, updatedAt: n.updatedAt
    })),
    selectedEdges: selectedEdges.map(e => ({ from: e.fromNodeId, to: e.toNodeId, relation: e.relation })),
    summaries,
    decisions,
    risks,
    constraints: Array.from(new Set(constraints)).slice(0, 20),
    confidence,
    missingContext: knownMissing,
    generatedAt: utils.nowIso()
  };
}

function retrieveProjectContext(query, services = {}) {
  const projectNodes = store.listKnowledgeNodes({ type: 'project', status: 'active', limit: 10 }, services);
  const related = store.listKnowledgeNodes({ status: 'active', limit: 500 }, services).filter(n => n.type !== 'project');
  const relevantRelated = filterRelevant(related, query);
  return {
    projects: projectNodes,
    related: relevantRelated.slice(0, 25),
    decisions: relevantRelated.filter(n => n.type === 'decision').slice(0, 10),
    risks: relevantRelated.filter(n => n.type === 'risk').slice(0, 10),
    contextPack: buildContextPack(query, { type: 'project' }, services)
  };
}

function retrievePhaseContext(phaseNumber, services = {}) {
  const target = String(phaseNumber || '').trim();
  const phaseNodes = store.listKnowledgeNodes({ type: 'phase', status: 'active', limit: 100 }, services).filter(p =>
    (p.title || '').toLowerCase().includes(`phase ${target}`.toLowerCase()) ||
    (p.title || '').toLowerCase().includes(`#${target}`) ||
    String(p.sourceId || '').includes(target) ||
    String(p.title || '') === target
  );
  const phaseIds = new Set(phaseNodes.map(n => n.id));
  const relatedEdges = store.listKnowledgeEdges({ limit: 1000 }, services).filter(e =>
    phaseIds.has(e.fromNodeId) || phaseIds.has(e.toNodeId)
  );
  const relatedNodeIds = new Set();
  for (const e of relatedEdges) {
    relatedNodeIds.add(e.fromNodeId);
    relatedNodeIds.add(e.toNodeId);
  }
  const relatedNodes = store.listKnowledgeNodes({ status: 'active', limit: 1000 }, services)
    .filter(n => relatedNodeIds.has(n.id) && !phaseIds.has(n.id))
    .slice(0, 25);
  return {
    phase: target,
    phaseNodes,
    relatedNodes,
    summary: `Phase ${target}: ${phaseNodes.length} phase nodes, ${relatedNodes.length} related nodes.`
  };
}

function retrieveIncidentContext(query, services = {}) {
  const incidents = store.listKnowledgeNodes({ type: 'incident', status: 'active', limit: 50 }, services);
  const deploys = store.listKnowledgeNodes({ type: 'deploy', status: 'active', limit: 50 }, services);
  const rollbacks = store.listKnowledgeNodes({ type: 'rollback', status: 'active', limit: 50 }, services);
  const matchedIncidents = filterRelevant(incidents, query);
  const matchedDeploys = filterRelevant(deploys, query);
  return {
    incidents: matchedIncidents,
    deploys: matchedDeploys,
    rollbacks: filterRelevant(rollbacks, query),
    contextPack: buildContextPack(query || 'incident', {}, services)
  };
}

function retrieveDecisionContext(query, services = {}) {
  const decisions = store.listKnowledgeNodes({ type: 'decision', status: 'active', limit: 100 }, services);
  const matched = filterRelevant(decisions, query);
  return {
    decisions: matched,
    summary: matched.map(d => `${d.title}: ${String(d.summary || '').slice(0, 150)}`),
    contextPack: buildContextPack(query || 'decision', {}, services)
  };
}

function retrieveAgentHandoffContext(query, services = {}) {
  const agents = store.listKnowledgeNodes({ type: 'agent', status: 'active', limit: 30 }, services);
  const docs = store.listKnowledgeNodes({ type: 'doc', status: 'active', limit: 30 }, services);
  return {
    agents,
    docs,
    contextPack: buildContextPack(query || 'handoff', {}, services)
  };
}

module.exports = {
  buildContextPack,
  retrieveProjectContext,
  retrievePhaseContext,
  retrieveIncidentContext,
  retrieveDecisionContext,
  retrieveAgentHandoffContext
};

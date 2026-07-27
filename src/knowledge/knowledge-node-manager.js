'use strict';

const store = require('./knowledge-graph-store');
const utils = require('./knowledge-utils');

function createNode(input, services = {}) {
  return store.createKnowledgeNode(input, services);
}

function updateNode(id, patch, services = {}) {
  return store.updateKnowledgeNode(id, patch, services);
}

function getNode(id, services = {}) {
  return store.getKnowledgeNode(id, services);
}

function listNodes(filters = {}, services = {}) {
  return store.listKnowledgeNodes(filters, services);
}

function archiveNode(id, reason, services = {}) {
  return store.archiveKnowledgeNode(id, reason, services);
}

function findByType(type, services = {}) {
  return store.listKnowledgeNodes({ type, status: 'active' }, services);
}

function findByTag(tag, services = {}) {
  return store.listKnowledgeNodes({ tag, status: 'active' }, services);
}

function findBySource(source, sourceId, services = {}) {
  if (sourceId) {
    const exact = store.listKnowledgeNodes({ source, sourceId, status: 'active' }, services);
    if (exact.length) return exact;
  }
  return store.listKnowledgeNodes({ source, status: 'active' }, services);
}

function fingerprintForDedup(input) {
  const type = String(input.type || '').toLowerCase();
  const title = String(input.title || '').trim().toLowerCase();
  const source = String(input.source || '').toLowerCase();
  const sourceId = String(input.sourceId || '').trim().toLowerCase();
  const summaryKey = String(input.summary || '').trim().toLowerCase().slice(0, 120);
  return `${type}::${title}::${source}::${sourceId}::${summaryKey}`;
}

function findSimilarNode(input, services = {}) {
  if (!input) return null;
  const candidates = store.listKnowledgeNodes({ type: input.type, status: 'active', limit: 200 }, services);
  const inputTitle = String(input.title || '').trim().toLowerCase();
  const inputSummaryKey = String(input.summary || '').trim().toLowerCase().slice(0, 120);
  const inputSource = String(input.source || '').toLowerCase();
  const inputSourceId = String(input.sourceId || '').trim().toLowerCase();
  if (!inputTitle) return null;
  if (inputSourceId) {
    const exact = candidates.find(n => String(n.sourceId || '').trim().toLowerCase() === inputSourceId);
    if (exact) return exact;
  }
  if (inputSource) {
    const sameSource = candidates.find(n =>
      String(n.title || '').trim().toLowerCase() === inputTitle &&
      String(n.source || '').toLowerCase() === inputSource
    );
    if (sameSource) return sameSource;
  }
  return candidates.find(n =>
    String(n.title || '').trim().toLowerCase() === inputTitle &&
    String(n.summary || '').trim().toLowerCase().slice(0, 120) === inputSummaryKey
  ) || null;
}

function linkToProject(nodeId, projectNodeId, services = {}) {
  return store.createKnowledgeEdge({
    fromNodeId: nodeId,
    toNodeId: projectNodeId,
    relation: 'relates_to',
    source: 'manager',
    evidence: 'project link'
  }, services);
}

function linkToPhase(nodeId, phaseNodeId, services = {}) {
  return store.createKnowledgeEdge({
    fromNodeId: nodeId,
    toNodeId: phaseNodeId,
    relation: 'relates_to',
    source: 'manager',
    evidence: 'phase link'
  }, services);
}

function summarizeNode(node) {
  if (!node) return null;
  return {
    id: node.id,
    type: node.type,
    title: node.title,
    summary: node.summary,
    sensitivity: node.sensitivity,
    status: node.status,
    confidence: node.confidence,
    tags: node.tags || [],
    updatedAt: node.updatedAt
  };
}

module.exports = {
  createNode,
  updateNode,
  getNode,
  listNodes,
  archiveNode,
  findByType,
  findByTag,
  findBySource,
  findSimilarNode,
  linkToProject,
  linkToPhase,
  summarizeNode,
  fingerprintForDedup
};

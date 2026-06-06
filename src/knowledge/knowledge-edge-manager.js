'use strict';

const store = require('./knowledge-graph-store');
const utils = require('./knowledge-utils');

function createEdge(input, services = {}) {
  return store.createKnowledgeEdge(input, services);
}

function listEdges(filters = {}, services = {}) {
  return store.listKnowledgeEdges(filters, services);
}

function edgesFromNode(nodeId, services = {}) {
  return store.listKnowledgeEdges({ nodeId }, services).filter(e => e.fromNodeId === nodeId);
}

function edgesToNode(nodeId, services = {}) {
  return store.listKnowledgeEdges({ nodeId }, services).filter(e => e.toNodeId === nodeId);
}

function relatedNodeIds(nodeId, services = {}) {
  const edges = store.listKnowledgeEdges({ nodeId }, services);
  return edges.map(e => e.fromNodeId === nodeId ? e.toNodeId : e.fromNodeId);
}

function safeConnect(fromNodeId, toNodeId, relation, options = {}, services = {}) {
  if (!utils.isValidRelation(relation)) return { ok: false, error: 'INVALID_RELATION' };
  return store.createKnowledgeEdge({
    fromNodeId,
    toNodeId,
    relation,
    confidence: options.confidence,
    source: options.source || 'edge-manager',
    evidence: options.evidence
  }, services);
}

function buildRelationMap(workspaceId, services = {}) {
  const edges = store.listKnowledgeEdges({ workspaceId, limit: 1000 }, services);
  const map = {};
  for (const e of edges) {
    if (!map[e.relation]) map[e.relation] = [];
    map[e.relation].push({ from: e.fromNodeId, to: e.toNodeId });
  }
  return map;
}

module.exports = {
  createEdge,
  listEdges,
  edgesFromNode,
  edgesToNode,
  relatedNodeIds,
  safeConnect,
  buildRelationMap
};

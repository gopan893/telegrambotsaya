'use strict';

const guards = require('./guards');
const semantic = require('./semantic-relationship-engine');

function getOrCreateNode(state, userId, label, options = {}) {
  const cleanLabel = guards.sanitizeText(label, 120).toLowerCase();
  if (!cleanLabel) return null;

  let node = state.graph.nodes.find((item) => item.label.toLowerCase() === cleanLabel);
  const ts = guards.nowIso();
  if (node) {
    node.lastSeenAt = ts;
    node.updatedAt = ts;
    node.importance = Math.max(node.importance || 0.45, guards.clamp01(options.importance, 0.45));
    node.confidence = Math.max(node.confidence || 0.5, guards.clamp01(options.confidence, 0.6));
    if (options.summary) node.summary = guards.compactText(`${node.summary || ''} ${options.summary}`, 400);
    return node;
  }

  node = {
    id: guards.stableId('node', `${userId}:${cleanLabel}`),
    userId: guards.normalizeUserId(userId),
    label: cleanLabel,
    type: options.type || semantic.classifyConceptType(cleanLabel, options.summary || ''),
    summary: guards.sanitizeText(options.summary || cleanLabel, 400),
    importance: guards.clamp01(options.importance, guards.importanceFromText(cleanLabel, 'cognitive_graph')),
    confidence: guards.clamp01(options.confidence, 0.62),
    source: guards.compactText(options.source || 'knowledge-graph', 80),
    createdAt: ts,
    updatedAt: ts,
    lastSeenAt: ts
  };
  state.graph.nodes.push(node);
  return node;
}

function upsertEdge(state, userId, from, to, relationship, options = {}) {
  if (!from || !to || from.id === to.id) return null;
  const rel = guards.sanitizeText(relationship || 'related_to', 60);
  let edge = state.graph.edges.find((item) => item.from === from.id && item.to === to.id && item.relationship === rel);
  const ts = guards.nowIso();
  if (edge) {
    edge.weight = guards.clamp01((edge.weight || 0.5) + (options.weight || 0.05), 0.5);
    edge.confidence = Math.max(edge.confidence || 0.5, guards.clamp01(options.confidence, 0.6));
    edge.updatedAt = ts;
    if (options.evidence) edge.evidence = guards.compactText(`${edge.evidence || ''} ${options.evidence}`, 500);
    return edge;
  }

  edge = {
    id: guards.stableId('edge', `${from.id}:${to.id}:${rel}`),
    userId: guards.normalizeUserId(userId),
    from: from.id,
    to: to.id,
    relationship: rel,
    weight: guards.clamp01(options.weight, 0.55),
    confidence: guards.clamp01(options.confidence, 0.6),
    evidence: guards.sanitizeText(options.evidence || '', 500),
    createdAt: ts,
    updatedAt: ts
  };
  state.graph.edges.push(edge);
  return edge;
}

function evolveGraphFromText(userId, text, botServices, options = {}) {
  const state = guards.ensureAIOSState(userId, botServices);
  const clean = guards.sanitizeText(text, 1800);
  if (!clean || guards.detectPromptInjection(clean)) return { ok: false, reason: 'GRAPH_TEXT_REJECTED' };

  const concepts = semantic.extractConcepts(clean, options.maxConcepts || 7);
  const nodes = concepts
    .map((concept) => getOrCreateNode(state, userId, concept, {
      summary: clean,
      source: options.source || 'interaction',
      importance: guards.importanceFromText(clean, 'cognitive_graph'),
      confidence: options.confidence || 0.62
    }))
    .filter(Boolean);

  const relationships = semantic.buildRelationships(clean, concepts);
  const edges = relationships
    .map((rel) => {
      const from = nodes.find((node) => node.label === rel.fromLabel);
      const to = nodes.find((node) => node.label === rel.toLabel);
      return upsertEdge(state, userId, from, to, rel.relationship, {
        weight: rel.weight,
        confidence: rel.confidence,
        evidence: clean
      });
    })
    .filter(Boolean);

  pruneGraph(userId, botServices);
  guards.touchState(state);
  guards.persistAsync(botServices);
  return { ok: true, nodes, edges };
}

function searchGraph(userId, query = '', botServices, limit = 8) {
  const state = guards.ensureAIOSState(userId, botServices);
  const nodes = state.graph.nodes
    .map((node) => ({
      node,
      score: guards.textRelevance(query, `${node.label} ${node.summary}`) + (node.importance || 0.4) * 0.4
    }))
    .filter((entry) => !query || entry.score > 0.18)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.node);

  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = state.graph.edges
    .filter((edge) => nodeIds.has(edge.from) || nodeIds.has(edge.to))
    .sort((a, b) => (b.weight || 0) - (a.weight || 0))
    .slice(0, limit * 2);

  return { nodes, edges };
}

function summarizeGraph(userId, botServices, query = '') {
  const state = guards.ensureAIOSState(userId, botServices);
  const graph = searchGraph(userId, query, botServices, 8);
  const labelById = new Map(state.graph.nodes.map((node) => [node.id, node.label]));
  const nodesText = graph.nodes.map((node) => `- ${node.label} (${node.type}, importance ${(node.importance || 0).toFixed(2)})`).join('\n') || '-';
  const edgesText = graph.edges.map((edge) => {
    return `- ${labelById.get(edge.from) || edge.from} ${edge.relationship} ${labelById.get(edge.to) || edge.to}`;
  }).join('\n') || '-';
  return {
    nodeCount: state.graph.nodes.length,
    edgeCount: state.graph.edges.length,
    nodesText,
    edgesText,
    nodes: graph.nodes,
    edges: graph.edges
  };
}

function pruneGraph(userId, botServices) {
  const state = guards.ensureAIOSState(userId, botServices);
  const nodeLimit = guards.DEFAULT_LIMITS.graphNodes;
  const edgeLimit = guards.DEFAULT_LIMITS.graphEdges;

  state.graph.nodes = guards.pruneListByScore(state.graph.nodes, nodeLimit, (node) => {
    const seen = Date.parse(node.lastSeenAt || node.updatedAt || node.createdAt || 0);
    const recency = seen ? Math.max(0, 1 - ((Date.now() - seen) / (150 * 24 * 60 * 60 * 1000))) : 0.2;
    return (node.importance || 0.4) + (node.confidence || 0.5) * 0.3 + recency * 0.2;
  });

  const validNodeIds = new Set(state.graph.nodes.map((node) => node.id));
  state.graph.edges = state.graph.edges
    .filter((edge) => validNodeIds.has(edge.from) && validNodeIds.has(edge.to));
  state.graph.edges = guards.pruneListByScore(state.graph.edges, edgeLimit, (edge) => {
    return (edge.weight || 0.4) + (edge.confidence || 0.5) * 0.3;
  });

  return {
    nodes: state.graph.nodes.length,
    edges: state.graph.edges.length
  };
}

function getGraphStats(userId, botServices) {
  const state = guards.ensureAIOSState(userId, botServices);
  return {
    nodes: state.graph.nodes.length,
    edges: state.graph.edges.length,
    topNodes: [...state.graph.nodes]
      .sort((a, b) => (b.importance || 0) - (a.importance || 0))
      .slice(0, 5)
  };
}

function resetGraph(userId, botServices) {
  const state = guards.ensureAIOSState(userId, botServices);
  state.graph = { nodes: [], edges: [] };
  guards.touchState(state);
  guards.persistAsync(botServices);
  return { ok: true };
}

module.exports = {
  getOrCreateNode,
  upsertEdge,
  evolveGraphFromText,
  searchGraph,
  summarizeGraph,
  pruneGraph,
  getGraphStats,
  resetGraph
};

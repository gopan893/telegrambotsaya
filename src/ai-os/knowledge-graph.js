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
    node.seenCount = Number(node.seenCount || 1) + 1;
    node.importance = Math.max(node.importance || 0.45, guards.clamp01(options.importance, 0.45));
    node.confidence = Math.max(node.confidence || 0.5, guards.clamp01(options.confidence, 0.6));
    if (options.summary) node.summary = guards.compactText(`${node.summary || ''} ${options.summary}`, 400);
    if (options.evolutionNote) {
      node.evolution = guards.safeArray(node.evolution).concat({
        note: guards.compactText(options.evolutionNote, 220),
        at: ts
      }).slice(-8);
    }
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
    seenCount: 1,
    evolution: options.evolutionNote
      ? [{ note: guards.compactText(options.evolutionNote, 220), at: ts }]
      : [],
    createdAt: ts,
    updatedAt: ts,
    lastSeenAt: ts
  };
  state.graph.nodes.push(node);
  return node;
}

function linkEntities(userId, fromInput, toInput, relationship = 'related_to', botServices, options = {}) {
  const state = guards.ensureAIOSState(userId, botServices);
  const from = getOrCreateNode(state, userId, fromInput.label || fromInput, {
    type: fromInput.type,
    summary: fromInput.summary || options.evidence,
    source: options.source || 'link',
    importance: options.importance || 0.62,
    confidence: options.confidence || 0.65
  });
  const to = getOrCreateNode(state, userId, toInput.label || toInput, {
    type: toInput.type,
    summary: toInput.summary || options.evidence,
    source: options.source || 'link',
    importance: options.importance || 0.62,
    confidence: options.confidence || 0.65
  });
  const edge = upsertEdge(state, userId, from, to, relationship, {
    weight: options.weight || 0.62,
    confidence: options.confidence || 0.65,
    evidence: options.evidence || ''
  });
  pruneGraph(userId, botServices);
  guards.touchState(state);
  guards.persistAsync(botServices);
  return { ok: !!edge, from, to, edge };
}

function linkGoalWorkflow(userId, goal, workflow, botServices) {
  return linkEntities(
    userId,
    { label: goal.title || goal.id, type: 'goal', summary: goal.description || goal.title },
    { label: workflow.title || workflow.id, type: 'workflow', summary: workflow.description || workflow.title },
    'linked_to_goal',
    botServices,
    { source: 'goal-workflow-link', evidence: `Goal ${goal.id} linked to workflow ${workflow.id}`, weight: 0.8, confidence: 0.86 }
  );
}

function linkMemoryToProject(userId, projectLabel, memory, botServices) {
  return linkEntities(
    userId,
    { label: projectLabel, type: 'project', summary: projectLabel },
    { label: guards.compactText(memory.content || memory.text || memory.id, 80), type: 'concept', summary: memory.content || memory.text || '' },
    'belongs_to_project',
    botServices,
    { source: 'project-memory-link', evidence: memory.content || memory.text || '', weight: 0.68, confidence: memory.confidence || 0.62 }
  );
}

function linkEvidenceToResearch(userId, researchTopic, evidence, botServices) {
  return linkEntities(
    userId,
    { label: evidence.title || evidence.url || 'evidence', type: 'evidence', summary: evidence.text || evidence.url || '' },
    { label: researchTopic, type: 'topic', summary: researchTopic },
    'evidence_for',
    botServices,
    { source: 'research-evidence-link', evidence: evidence.text || evidence.url || '', weight: 0.72, confidence: evidence.confidence || 0.62 }
  );
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
  const typeCounts = countNodeTypes(state.graph.nodes);
  const nodesText = graph.nodes.map((node) => `- ${node.label} (${node.type}, importance ${(node.importance || 0).toFixed(2)})`).join('\n') || '-';
  const edgesText = graph.edges.map((edge) => {
    return `- ${labelById.get(edge.from) || edge.from} ${edge.relationship} ${labelById.get(edge.to) || edge.to}`;
  }).join('\n') || '-';
  return {
    nodeCount: state.graph.nodes.length,
    edgeCount: state.graph.edges.length,
    typeCounts,
    typeSummary: Object.entries(typeCounts).map(([type, count]) => `${type}:${count}`).join(', ') || '-',
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

function cleanupStaleGraph(userId, botServices, staleDays = 150) {
  const state = guards.ensureAIOSState(userId, botServices);
  const cutoff = Date.now() - staleDays * 24 * 60 * 60 * 1000;
  const beforeNodes = state.graph.nodes.length;
  state.graph.nodes = state.graph.nodes.filter((node) => {
    const seen = Date.parse(node.lastSeenAt || node.updatedAt || node.createdAt || 0);
    return (node.importance || 0) >= 0.72 || !seen || seen >= cutoff;
  });
  const valid = new Set(state.graph.nodes.map((node) => node.id));
  const beforeEdges = state.graph.edges.length;
  state.graph.edges = state.graph.edges.filter((edge) => valid.has(edge.from) && valid.has(edge.to));
  guards.touchState(state);
  guards.persistAsync(botServices);
  return {
    removedNodes: beforeNodes - state.graph.nodes.length,
    removedEdges: beforeEdges - state.graph.edges.length
  };
}

function countNodeTypes(nodes = []) {
  return guards.safeArray(nodes).reduce((acc, node) => {
    acc[node.type || 'concept'] = (acc[node.type || 'concept'] || 0) + 1;
    return acc;
  }, {});
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
  linkEntities,
  linkGoalWorkflow,
  linkMemoryToProject,
  linkEvidenceToResearch,
  searchGraph,
  summarizeGraph,
  pruneGraph,
  cleanupStaleGraph,
  countNodeTypes,
  getGraphStats,
  resetGraph
};

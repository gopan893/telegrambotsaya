'use strict';

const guards = require('./guards');
const graphGuards = require('./graph-guards');
const graphUtils = require('./graph-utils');
const conceptExtractor = require('./concept-extractor');
const semantic = require('./semantic-relationship-engine');
const utils = require('./aios-utils');

const STORAGE_KEY = 'aios_graph';
const STORAGE_KEYS = {
  legacy: STORAGE_KEY,
  nodes: 'aios_graph_nodes',
  edges: 'aios_graph_edges'
};

function getState(userId, services = {}) {
  const state = services.state || guards.ensureAIOSState(userId, services);
  if (!state.graph || typeof state.graph !== 'object') state.graph = { nodes: [], edges: [] };
  state.graph.nodes = Array.isArray(state.graph.nodes) ? state.graph.nodes.map(node => normalizeNode(userId, node)).filter(Boolean) : [];
  state.graph.edges = Array.isArray(state.graph.edges) ? state.graph.edges.map(edge => normalizeEdge(userId, edge)).filter(Boolean) : [];
  return state;
}

function normalizeNode(userId, node = {}) {
  const label = graphGuards.sanitizeConceptLabel(node.label);
  if (!label) return null;
  const now = graphUtils.nowIso();
  return {
    id: node.id || graphUtils.makeNodeId(userId, label),
    userId: graphUtils.normalizeUserId(node.userId || userId),
    label,
    type: graphGuards.VALID_NODE_TYPES.has(node.type) ? node.type : semantic.classifyConceptType(label, node.summary || ''),
    summary: graphUtils.compactText(node.summary || label, 500),
    aliases: graphUtils.uniqueStrings(node.aliases || [], graphUtils.DEFAULT_GRAPH_LIMITS.maxAliasesPerNode),
    tags: graphUtils.uniqueStrings(node.tags || [], 20),
    importance: graphUtils.clamp01(node.importance, 0.5),
    confidence: graphUtils.clamp01(node.confidence, 0.5),
    source: graphUtils.compactText(node.source || 'knowledge-graph', 80),
    sourceId: node.sourceId || node.source_id || null,
    createdAt: node.createdAt || node.created_at || now,
    updatedAt: node.updatedAt || node.updated_at || now,
    lastSeenAt: node.lastSeenAt || node.last_seen_at || node.updatedAt || now,
    occurrenceCount: Number(node.occurrenceCount || node.occurrence_count || node.seenCount || 1),
    evolution: Array.isArray(node.evolution) ? node.evolution.slice(-8) : []
  };
}

function normalizeEdge(userId, edge = {}) {
  const from = edge.from || edge.fromNodeId || edge.from_node_id;
  const to = edge.to || edge.toNodeId || edge.to_node_id;
  if (!from || !to || from === to) return null;
  const relationship = graphGuards.VALID_RELATIONSHIPS.has(edge.relationship) ? edge.relationship : 'related_to';
  const now = graphUtils.nowIso();
  return {
    id: edge.id || graphUtils.makeEdgeId(userId, from, to, relationship),
    userId: graphUtils.normalizeUserId(edge.userId || userId),
    from,
    to,
    relationship,
    weight: graphUtils.clamp01(edge.weight, 0.55),
    confidence: graphUtils.clamp01(edge.confidence, 0.5),
    evidence: graphUtils.compactText(edge.evidence || '', 500),
    source: graphUtils.compactText(edge.source || 'knowledge-graph', 80),
    sourceId: edge.sourceId || edge.source_id || null,
    createdAt: edge.createdAt || edge.created_at || now,
    updatedAt: edge.updatedAt || edge.updated_at || now,
    occurrenceCount: Number(edge.occurrenceCount || edge.occurrence_count || 1)
  };
}

function persistGraph(userId, state, services = {}) {
  pruneGraph(userId, { ...services, state });
  guards.touchState(state);
  void mirrorGraphToStorage(userId, state, services);
  guards.persistAsync(services);
}

function findNodeInState(state, label) {
  const key = graphUtils.normalizeKey(label);
  if (!key) return null;
  return state.graph.nodes.find(node => {
    if (graphUtils.normalizeKey(node.label) === key) return true;
    return (node.aliases || []).some(alias => graphUtils.normalizeKey(alias) === key);
  }) || null;
}

function findNodeByLabel(userId, label, services = {}) {
  return findNodeInState(getState(userId, services), label);
}

function createNode(userId, data = {}, services = {}) {
  const state = getState(userId, services);
  const validation = graphGuards.validateNode({ ...data, label: data.label || data.name });
  if (!validation.ok) return { ok: false, reason: validation.reason };

  const incoming = validation.node;
  const existing = findNodeInState(state, incoming.label);
  const ts = graphUtils.nowIso();

  if (existing) {
    existing.type = incoming.type || existing.type;
    existing.summary = graphUtils.compactText(incoming.summary && incoming.summary !== incoming.label
      ? `${existing.summary || ''} ${incoming.summary}`
      : existing.summary || incoming.label, 500);
    existing.aliases = graphUtils.mergeUnique(existing.aliases, incoming.aliases || [incoming.label], graphUtils.DEFAULT_GRAPH_LIMITS.maxAliasesPerNode);
    existing.tags = graphUtils.mergeUnique(existing.tags, incoming.tags, 20);
    existing.importance = Math.max(existing.importance || 0.5, incoming.importance || 0.5);
    existing.confidence = Math.max(existing.confidence || 0.5, incoming.confidence || 0.5);
    existing.source = incoming.source || existing.source;
    existing.sourceId = incoming.sourceId || existing.sourceId;
    existing.lastSeenAt = ts;
    existing.updatedAt = ts;
    existing.occurrenceCount = Number(existing.occurrenceCount || 1) + 1;
    if (incoming.evolutionNote) {
      existing.evolution = [...(existing.evolution || []), {
        note: graphUtils.compactText(incoming.evolutionNote, 220),
        at: ts
      }].slice(-8);
    }
    persistGraph(userId, state, services);
    return { ok: true, node: existing, created: false };
  }

  const node = normalizeNode(userId, {
    ...incoming,
    id: incoming.id || graphUtils.makeNodeId(userId, incoming.label),
    createdAt: ts,
    updatedAt: ts,
    lastSeenAt: ts,
    occurrenceCount: incoming.occurrenceCount || 1
  });

  state.graph.nodes.push(node);
  persistGraph(userId, state, services);
  return { ok: true, node, created: true };
}

function updateNode(userId, nodeId, patch = {}, services = {}) {
  const state = getState(userId, services);
  const node = state.graph.nodes.find(item => item.id === nodeId);
  if (!node) return { ok: false, reason: 'NODE_NOT_FOUND' };
  const next = { ...node, ...patch, updatedAt: graphUtils.nowIso() };
  const validation = graphGuards.validateNode(next);
  if (!validation.ok) return { ok: false, reason: validation.reason };
  Object.assign(node, normalizeNode(userId, validation.node));
  persistGraph(userId, state, services);
  return { ok: true, node };
}

function listNodes(userId, options = {}, services = {}) {
  const state = getState(userId, services);
  const type = options.type || null;
  const query = options.query || '';
  const limit = options.limit || graphUtils.DEFAULT_GRAPH_LIMITS.topK;
  return state.graph.nodes
    .filter(node => !type || node.type === type)
    .map(node => ({ node, score: graphUtils.scoreNode(node, query) }))
    .filter(entry => !query || entry.score > 0.12 || graphUtils.nodeSearchText(entry.node).toLowerCase().includes(String(query).toLowerCase()))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(entry => entry.node);
}

function deleteNode(userId, nodeId, services = {}) {
  const state = getState(userId, services);
  const beforeNodes = state.graph.nodes.length;
  state.graph.nodes = state.graph.nodes.filter(node => node.id !== nodeId);
  state.graph.edges = state.graph.edges.filter(edge => edge.from !== nodeId && edge.to !== nodeId);
  persistGraph(userId, state, services);
  return { ok: state.graph.nodes.length < beforeNodes, id: nodeId };
}

function resolveNodeReference(userId, value, services = {}, fallbackType = 'concept') {
  if (!value) return null;
  const state = getState(userId, services);
  const raw = typeof value === 'object' ? (value.id || value.label) : value;
  const byId = state.graph.nodes.find(node => node.id === raw);
  if (byId) return byId;
  const byLabel = findNodeInState(state, typeof value === 'object' ? value.label : value);
  if (byLabel) return byLabel;
  const created = createNode(userId, typeof value === 'object' ? value : { label: value, type: fallbackType }, services);
  return created.ok ? created.node : null;
}

function createEdge(userId, data = {}, services = {}) {
  const from = resolveNodeReference(userId, data.from || data.fromNodeId || data.fromLabel, services);
  const to = resolveNodeReference(userId, data.to || data.toNodeId || data.toLabel, services);
  if (!from || !to) return { ok: false, reason: 'EDGE_NODE_NOT_FOUND' };
  const state = getState(userId, services);

  const relationship = data.relationship || 'related_to';
  const validation = graphGuards.validateEdge({
    ...data,
    from: from.id,
    to: to.id,
    relationship
  });
  if (!validation.ok) return { ok: false, reason: validation.reason };

  const incoming = validation.edge;
  const ts = graphUtils.nowIso();
  const existing = state.graph.edges.find(edge => edge.from === from.id && edge.to === to.id && edge.relationship === incoming.relationship);

  if (existing) {
    existing.weight = graphUtils.clamp01((existing.weight || 0.5) + Math.max(0.04, incoming.weight * 0.12), 0.7);
    existing.confidence = Math.max(existing.confidence || 0.5, incoming.confidence || 0.5);
    existing.evidence = graphUtils.compactText(`${existing.evidence || ''} ${incoming.evidence || ''}`, 500);
    existing.source = incoming.source || existing.source;
    existing.sourceId = incoming.sourceId || existing.sourceId;
    existing.updatedAt = ts;
    existing.occurrenceCount = Number(existing.occurrenceCount || 1) + 1;
    persistGraph(userId, state, services);
    return { ok: true, edge: existing, from, to, created: false };
  }

  const edge = normalizeEdge(userId, {
    ...incoming,
    id: incoming.id || graphUtils.makeEdgeId(userId, from.id, to.id, incoming.relationship),
    from: from.id,
    to: to.id,
    createdAt: ts,
    updatedAt: ts,
    occurrenceCount: incoming.occurrenceCount || 1
  });

  state.graph.edges.push(edge);
  persistGraph(userId, state, services);
  return { ok: true, edge, from, to, created: true };
}

function updateEdge(userId, edgeId, patch = {}, services = {}) {
  const state = getState(userId, services);
  const edge = state.graph.edges.find(item => item.id === edgeId);
  if (!edge) return { ok: false, reason: 'EDGE_NOT_FOUND' };
  const validation = graphGuards.validateEdge({ ...edge, ...patch, updatedAt: graphUtils.nowIso() });
  if (!validation.ok) return { ok: false, reason: validation.reason };
  Object.assign(edge, normalizeEdge(userId, validation.edge));
  persistGraph(userId, state, services);
  return { ok: true, edge };
}

function listEdges(userId, options = {}, services = {}) {
  const state = getState(userId, services);
  const labelById = new Map(state.graph.nodes.map(node => [node.id, node.label]));
  const relationship = options.relationship || null;
  const query = options.query || '';
  const nodeId = options.nodeId || null;
  const limit = options.limit || graphUtils.DEFAULT_GRAPH_LIMITS.edgeTopK;
  return state.graph.edges
    .filter(edge => !relationship || edge.relationship === relationship)
    .filter(edge => !nodeId || edge.from === nodeId || edge.to === nodeId)
    .map(edge => ({ edge, score: graphUtils.scoreEdge(edge, query, labelById) }))
    .filter(entry => !query || entry.score > 0.1 || graphUtils.edgeSearchText(entry.edge, labelById).toLowerCase().includes(String(query).toLowerCase()))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(entry => entry.edge);
}

function deleteEdge(userId, edgeId, services = {}) {
  const state = getState(userId, services);
  const before = state.graph.edges.length;
  state.graph.edges = state.graph.edges.filter(edge => edge.id !== edgeId);
  persistGraph(userId, state, services);
  return { ok: state.graph.edges.length < before, id: edgeId };
}

function upsertConcept(userId, concept, services = {}) {
  const data = typeof concept === 'string' ? { label: concept } : concept;
  return createNode(userId, {
    ...data,
    type: data.type || semantic.classifyConceptType(data.label, data.summary || data.evidence || ''),
    source: data.source || 'concept-upsert'
  }, services);
}

function linkConcepts(userId, fromLabel, toLabel, relationship = 'related_to', evidence = '', services = {}) {
  const from = upsertConcept(userId, typeof fromLabel === 'object' ? fromLabel : {
    label: fromLabel,
    summary: evidence,
    source: 'relationship-link'
  }, services);
  const to = upsertConcept(userId, typeof toLabel === 'object' ? toLabel : {
    label: toLabel,
    summary: evidence,
    source: 'relationship-link'
  }, services);
  if (!from.ok || !to.ok) return { ok: false, reason: from.reason || to.reason || 'NODE_LINK_FAILED' };
  return createEdge(userId, {
    from: from.node.id,
    to: to.node.id,
    relationship,
    evidence,
    source: 'manual-relationship',
    confidence: semantic.scoreRelationshipConfidence(relationship, evidence),
    weight: 0.68
  }, services);
}

function getOrCreateNode(state, userId, label, options = {}) {
  const services = { state };
  if (state && !services.state.graph) services.state.graph = { nodes: [], edges: [] };
  const result = createNode(userId, { label, ...options }, services);
  return result.ok ? result.node : null;
}

function upsertEdge(state, userId, from, to, relationship, options = {}) {
  const result = createEdge(userId, {
    from: from?.id || from,
    to: to?.id || to,
    relationship,
    ...options
  }, { state });
  return result.ok ? result.edge : null;
}

function linkEntities(userId, fromInput, toInput, relationship = 'related_to', services = {}, options = {}) {
  return linkConcepts(
    userId,
    {
      label: fromInput.label || fromInput,
      type: fromInput.type,
      summary: fromInput.summary || options.evidence,
      source: options.source || 'link'
    },
    {
      label: toInput.label || toInput,
      type: toInput.type,
      summary: toInput.summary || options.evidence,
      source: options.source || 'link'
    },
    relationship,
    options.evidence || '',
    services
  );
}

function linkGoalWorkflow(userId, goal, workflow, services) {
  return linkEntities(
    userId,
    { label: goal.title || goal.id, type: 'goal', summary: goal.description || goal.title },
    { label: workflow.title || workflow.id, type: 'workflow', summary: workflow.description || workflow.title },
    'linked_to_goal',
    services,
    { source: 'goal-workflow-link', evidence: `Goal ${goal.id} linked to workflow ${workflow.id}`, weight: 0.8, confidence: 0.86 }
  );
}

function linkMemoryToProject(userId, projectLabel, memory, services) {
  return linkEntities(
    userId,
    { label: projectLabel, type: 'project', summary: projectLabel },
    { label: graphUtils.compactText(memory.content || memory.text || memory.id, 80), type: 'memory', summary: memory.content || memory.text || '' },
    'belongs_to_project',
    services,
    { source: 'project-memory-link', evidence: memory.content || memory.text || '', weight: 0.68, confidence: memory.confidence || 0.62 }
  );
}

function linkEvidenceToResearch(userId, researchTopic, evidence, services) {
  return linkEntities(
    userId,
    { label: evidence.title || evidence.url || 'evidence', type: 'evidence', summary: evidence.text || evidence.url || '' },
    { label: researchTopic, type: 'topic', summary: researchTopic },
    'evidence_for',
    services,
    { source: 'research-evidence-link', evidence: evidence.text || evidence.url || '', weight: 0.72, confidence: evidence.confidence || 0.62 }
  );
}

function evolveGraphFromText(userId, text, services = {}, options = {}) {
  const clean = graphUtils.compactText(text, options.maxChars || 1800);
  if (!clean || guards.detectPromptInjection(clean)) return { ok: false, reason: 'GRAPH_TEXT_REJECTED' };
  if (!graphGuards.preventSensitiveGraphStorage(clean)) return { ok: false, reason: 'SENSITIVE_GRAPH_REJECTED' };

  const concepts = conceptExtractor.extractConcepts(clean, {
    maxConcepts: options.maxConcepts || 8,
    source: options.source
  });
  const nodes = [];
  for (const concept of concepts) {
    const result = upsertConcept(userId, {
      ...concept,
      source: options.source || concept.source || 'interaction',
      confidence: options.confidence || concept.confidence,
      summary: clean
    }, services);
    if (result.ok) nodes.push(result.node);
  }

  const relationships = semantic.detectRelationships(clean, concepts, { maxConcepts: options.maxConcepts || 8 }, services);
  const edges = [];
  for (const rel of relationships) {
    const result = linkConcepts(userId, rel.fromLabel, rel.toLabel, rel.relationship, rel.evidence || clean, services);
    if (result.ok) {
      updateEdge(userId, result.edge.id, {
        confidence: rel.confidence,
        weight: rel.weight,
        source: options.source || 'semantic-relationship'
      }, services);
      edges.push(result.edge);
    }
  }

  pruneGraph(userId, services);
  return { ok: true, nodes, edges, concepts, relationships };
}

function getNeighbors(userId, nodeIdOrLabel, options = {}, services = {}) {
  const node = findNodeByLabel(userId, nodeIdOrLabel, services) || getState(userId, services).graph.nodes.find(item => item.id === nodeIdOrLabel);
  if (!node) return { node: null, neighbors: [], edges: [] };
  const state = getState(userId, services);
  const edges = listEdges(userId, { nodeId: node.id, limit: options.limit || 20 }, services);
  const ids = new Set(edges.flatMap(edge => [edge.from, edge.to]).filter(id => id !== node.id));
  const neighbors = state.graph.nodes.filter(item => ids.has(item.id)).slice(0, options.limit || 12);
  return { node, neighbors, edges };
}

function searchGraph(userId, query = '', services = {}, limit = 8) {
  const nodes = listNodes(userId, { query, limit }, services);
  const nodeIds = new Set(nodes.map(node => node.id));
  const edges = listEdges(userId, { query, limit: limit * 2 }, services)
    .filter(edge => nodeIds.has(edge.from) || nodeIds.has(edge.to))
    .slice(0, limit * 2);
  return { nodes, edges };
}

function countNodeTypes(nodes = []) {
  return graphUtils.countBy(nodes, node => node.type || 'concept');
}

function getGraphStats(userId, services = {}) {
  const state = getState(userId, services);
  const relationshipCounts = graphUtils.countBy(state.graph.edges, edge => edge.relationship || 'related_to');
  return {
    nodes: state.graph.nodes.length,
    edges: state.graph.edges.length,
    nodeTypes: countNodeTypes(state.graph.nodes),
    relationships: relationshipCounts,
    lowConfidenceEdges: state.graph.edges.filter(edge => Number(edge.confidence || 0) < 0.45).length,
    staleNodes: state.graph.nodes.filter(node => graphUtils.recencyScore(node.lastSeenAt || node.updatedAt, 120) < 0.35).length,
    topNodes: [...state.graph.nodes]
      .sort((a, b) => graphUtils.scoreNode(b) - graphUtils.scoreNode(a))
      .slice(0, 8)
  };
}

function pruneGraph(userId, services = {}, options = {}) {
  const state = getState(userId, services);
  const beforeNodes = state.graph.nodes.length;
  const beforeEdges = state.graph.edges.length;
  state.graph = graphGuards.preventGraphBloat(state.graph, {
    maxNodesPerUser: options.maxNodesPerUser || graphUtils.DEFAULT_GRAPH_LIMITS.maxNodesPerUser,
    maxEdgesPerUser: options.maxEdgesPerUser || graphUtils.DEFAULT_GRAPH_LIMITS.maxEdgesPerUser
  });
  return {
    nodes: state.graph.nodes.length,
    edges: state.graph.edges.length,
    removedNodes: beforeNodes - state.graph.nodes.length,
    removedEdges: beforeEdges - state.graph.edges.length
  };
}

function cleanupStaleGraph(userId, services = {}, staleDays = 150) {
  const state = getState(userId, services);
  const cutoff = Date.now() - staleDays * 24 * 60 * 60 * 1000;
  const beforeNodes = state.graph.nodes.length;
  state.graph.nodes = state.graph.nodes.filter(node => {
    const seen = Date.parse(node.lastSeenAt || node.updatedAt || node.createdAt || 0);
    return (node.importance || 0) >= 0.72 || !seen || seen >= cutoff;
  });
  const valid = new Set(state.graph.nodes.map(node => node.id));
  const beforeEdges = state.graph.edges.length;
  state.graph.edges = state.graph.edges.filter(edge => valid.has(edge.from) && valid.has(edge.to));
  persistGraph(userId, state, services);
  return {
    removedNodes: beforeNodes - state.graph.nodes.length,
    removedEdges: beforeEdges - state.graph.edges.length
  };
}

function buildGraphSnapshot(userId, options = {}, services = {}) {
  const state = getState(userId, services);
  const query = options.query || '';
  const nodes = listNodes(userId, { query, type: options.type, limit: options.nodeLimit || graphUtils.DEFAULT_GRAPH_LIMITS.topK }, services);
  const nodeIds = new Set(nodes.map(node => node.id));
  const edges = listEdges(userId, { query, relationship: options.relationship, limit: options.edgeLimit || graphUtils.DEFAULT_GRAPH_LIMITS.edgeTopK }, services)
    .filter(edge => !nodeIds.size || nodeIds.has(edge.from) || nodeIds.has(edge.to));
  const labelById = new Map(state.graph.nodes.map(node => [node.id, node.label]));
  const summaryText = [
    nodes.length ? `Nodes: ${nodes.map(node => `${node.label} (${node.type})`).join(', ')}` : 'Nodes: -',
    edges.length ? `Edges: ${edges.map(edge => `${labelById.get(edge.from) || edge.from} ${edge.relationship} ${labelById.get(edge.to) || edge.to}`).join('; ')}` : 'Edges: -'
  ].join('\n');
  return {
    nodes,
    edges,
    allNodeCount: state.graph.nodes.length,
    allEdgeCount: state.graph.edges.length,
    summaryText: graphUtils.compactText(summaryText, options.summaryChars || graphUtils.DEFAULT_GRAPH_LIMITS.summaryChars)
  };
}

function summarizeGraph(userId, services = {}, query = '') {
  const state = getState(userId, services);
  const graph = searchGraph(userId, query, services, 8);
  const labelById = new Map(state.graph.nodes.map(node => [node.id, node.label]));
  const typeCounts = countNodeTypes(state.graph.nodes);
  const nodesText = graph.nodes.map((node) => `- ${node.label} (${node.type}, importance ${(node.importance || 0).toFixed(2)}, seen ${node.occurrenceCount || 1})`).join('\n') || '-';
  const edgesText = graph.edges.map((edge) => {
    return `- ${labelById.get(edge.from) || edge.from} ${edge.relationship} ${labelById.get(edge.to) || edge.to} (${Number(edge.confidence || 0).toFixed(2)})`;
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

function resetGraph(userId, services = {}) {
  const state = getState(userId, services);
  state.graph = { nodes: [], edges: [] };
  persistGraph(userId, state, services);
  return { ok: true };
}

async function hydrateGraphFromStorage(userId, services = {}) {
  const state = getState(userId, services);
  if (!services.storageManager?.loadData) return state;
  try {
    const [storedNodes, storedEdges, legacy] = await Promise.all([
      utils.loadUserBucket(STORAGE_KEYS.nodes, userId, services, []),
      utils.loadUserBucket(STORAGE_KEYS.edges, userId, services, []),
      utils.loadUserBucket(STORAGE_KEYS.legacy, userId, services, { nodes: [], edges: [] })
    ]);

    const currentEmpty = !state.graph.nodes.length && !state.graph.edges.length;
    if (currentEmpty && (storedNodes.length || storedEdges.length || legacy.nodes?.length || legacy.edges?.length)) {
      state.graph = {
        nodes: (storedNodes.length ? storedNodes : legacy.nodes || []).map(node => normalizeNode(userId, node)).filter(Boolean),
        edges: (storedEdges.length ? storedEdges : legacy.edges || []).map(edge => normalizeEdge(userId, edge)).filter(Boolean)
      };
      pruneGraph(userId, services);
      guards.touchState(state);
    }
  } catch (_) {}
  return state;
}

async function mirrorGraphToStorage(userId, state, services = {}) {
  if (!services.storageManager?.saveData) return false;
  try {
    const cleanState = getState(userId, { ...services, state });
    pruneGraph(userId, { ...services, state: cleanState });
    await Promise.all([
      utils.saveUserBucket(STORAGE_KEYS.nodes, userId, cleanState.graph.nodes, services),
      utils.saveUserBucket(STORAGE_KEYS.edges, userId, cleanState.graph.edges, services),
      utils.saveUserBucket(STORAGE_KEYS.legacy, userId, {
        nodes: cleanState.graph.nodes,
        edges: cleanState.graph.edges
      }, services)
    ]);
    return true;
  } catch (_) {
    return false;
  }
}

module.exports = {
  STORAGE_KEY,
  STORAGE_KEYS,
  buildGraphSnapshot,
  cleanupStaleGraph,
  countNodeTypes,
  createEdge,
  createNode,
  deleteEdge,
  deleteNode,
  evolveGraphFromText,
  findNodeByLabel,
  getGraphStats,
  getNeighbors,
  getOrCreateNode,
  hydrateGraphFromStorage,
  linkConcepts,
  linkEntities,
  linkEvidenceToResearch,
  linkGoalWorkflow,
  linkMemoryToProject,
  listEdges,
  listNodes,
  mirrorGraphToStorage,
  pruneGraph,
  resetGraph,
  searchGraph,
  summarizeGraph,
  updateEdge,
  updateNode,
  upsertConcept,
  upsertEdge
};

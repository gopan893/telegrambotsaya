'use strict';

const utils = require('./graph-utils');

const SENSITIVE_PATTERNS = [
  /\b(api[_\s-]?key|token|password|passwd|secret|private\s+key|credential|authorization\s+header)\b/i,
  /\b(database_url|redis_url|telegram_token|groq_api_key|mistral_api_key|openai_api_key)\b/i,
  /\bpostgres(?:ql)?:\/\/[^:\s]+:[^@\s]+@/i,
  /\bredis:\/\/[^:\s]+:[^@\s]+@/i,
  /\b(?:sk|ghp|github_pat|xoxb|bot)[-_][A-Za-z0-9_-]{20,}\b/i,
  /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----/i
];

const VALID_NODE_TYPES = new Set([
  'project',
  'concept',
  'technology',
  'tool',
  'goal',
  'workflow',
  'insight',
  'memory',
  'decision',
  'risk',
  'assumption',
  'evidence',
  'learning_topic',
  'problem',
  'solution',
  'phase',
  'command',
  'topic',
  'source'
]);

const VALID_RELATIONSHIPS = new Set([
  'related_to',
  'supports',
  'contradicts',
  'depends_on',
  'part_of',
  'improves',
  'blocks',
  'belongs_to_project',
  'linked_to_goal',
  'linked_to_workflow',
  'derived_from',
  'evidence_for',
  'risk_for',
  'solution_for',
  'causes',
  'uses',
  'requires',
  'evolves_into',
  'similar_to'
]);

function sanitizeConceptLabel(label = '') {
  return utils.normalizeConcept(label)
    .replace(/[\u0000-\u001F]/g, '')
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, 120);
}

function preventSensitiveGraphStorage(text = '') {
  const clean = String(text || '');
  return !SENSITIVE_PATTERNS.some(pattern => pattern.test(clean));
}

function validateNode(node = {}) {
  const label = sanitizeConceptLabel(node.label);
  if (!label) return { ok: false, reason: 'EMPTY_LABEL' };
  if (!preventSensitiveGraphStorage(`${label} ${node.summary || ''} ${(node.aliases || []).join(' ')}`)) {
    return { ok: false, reason: 'SENSITIVE_GRAPH_CONTENT' };
  }
  return {
    ok: true,
    node: {
      ...node,
      label,
      type: VALID_NODE_TYPES.has(node.type) ? node.type : 'concept',
      summary: utils.compactText(node.summary || label, 500),
      aliases: utils.uniqueStrings(node.aliases || [], utils.DEFAULT_GRAPH_LIMITS.maxAliasesPerNode),
      tags: utils.uniqueStrings(node.tags || [], 20),
      importance: utils.clamp01(node.importance, 0.5),
      confidence: utils.clamp01(node.confidence, 0.5)
    }
  };
}

function validateEdge(edge = {}) {
  if (!edge.from || !edge.to) return { ok: false, reason: 'MISSING_ENDPOINT' };
  if (String(edge.from) === String(edge.to)) return { ok: false, reason: 'SELF_EDGE' };
  if (!preventSensitiveGraphStorage(`${edge.evidence || ''} ${edge.source || ''}`)) {
    return { ok: false, reason: 'SENSITIVE_GRAPH_CONTENT' };
  }
  const relationship = VALID_RELATIONSHIPS.has(edge.relationship) ? edge.relationship : 'related_to';
  return {
    ok: true,
    edge: {
      ...edge,
      relationship,
      evidence: utils.compactText(edge.evidence || 'Relasi dibuat dari konteks percakapan.', 500),
      source: utils.compactText(edge.source || 'knowledge-graph', 80),
      weight: utils.clamp01(edge.weight, 0.55),
      confidence: utils.clamp01(edge.confidence, 0.5)
    }
  };
}

function preventDuplicateExplosion(items = [], keyFn = item => item.id) {
  const seen = new Set();
  const out = [];
  for (const item of Array.isArray(items) ? items : []) {
    const key = keyFn(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function preventGraphBloat(graph = {}, limits = {}) {
  const nodeLimit = limits.maxNodesPerUser || utils.DEFAULT_GRAPH_LIMITS.maxNodesPerUser;
  const edgeLimit = limits.maxEdgesPerUser || utils.DEFAULT_GRAPH_LIMITS.maxEdgesPerUser;
  const nodes = [...(Array.isArray(graph.nodes) ? graph.nodes : [])]
    .sort((a, b) => utils.scoreNode(b) - utils.scoreNode(a))
    .slice(0, nodeLimit);
  const valid = new Set(nodes.map(node => node.id));
  const edges = [...(Array.isArray(graph.edges) ? graph.edges : [])]
    .filter(edge => valid.has(edge.from) && valid.has(edge.to))
    .sort((a, b) => utils.scoreEdge(b) - utils.scoreEdge(a))
    .slice(0, edgeLimit);
  return { nodes, edges };
}

function limitGraphContext(snapshot = {}, options = {}) {
  const nodeLimit = options.nodeLimit || utils.DEFAULT_GRAPH_LIMITS.topK;
  const edgeLimit = options.edgeLimit || utils.DEFAULT_GRAPH_LIMITS.edgeTopK;
  return {
    nodes: utils.limitArray(snapshot.nodes, nodeLimit),
    edges: utils.limitArray(snapshot.edges, edgeLimit),
    summaryText: utils.compactText(snapshot.summaryText || '', options.summaryChars || utils.DEFAULT_GRAPH_LIMITS.summaryChars)
  };
}

function detectLowConfidenceGraph(snapshot = {}, threshold = 0.45) {
  const lowNodes = (snapshot.nodes || []).filter(node => Number(node.confidence || 0) < threshold);
  const lowEdges = (snapshot.edges || []).filter(edge => Number(edge.confidence || 0) < threshold);
  return {
    lowConfidence: Boolean(lowNodes.length || lowEdges.length),
    lowNodes,
    lowEdges
  };
}

function safeGraphFallback(error, fallback = {}) {
  return {
    ok: false,
    reason: 'GRAPH_FALLBACK',
    error: error?.message || String(error || ''),
    ...fallback
  };
}

module.exports = {
  SENSITIVE_PATTERNS,
  VALID_NODE_TYPES,
  VALID_RELATIONSHIPS,
  detectLowConfidenceGraph,
  limitGraphContext,
  preventDuplicateExplosion,
  preventGraphBloat,
  preventSensitiveGraphStorage,
  safeGraphFallback,
  sanitizeConceptLabel,
  validateEdge,
  validateNode
};

'use strict';

const utils = require('./knowledge-utils');

let nodes = [];
let edges = [];
let auditLog = [];
let idCounter = 1;

function generateNodeId() {
  return utils.safeId('kn', idCounter++);
}

function generateEdgeId() {
  return utils.safeId('ke', idCounter++);
}

function createKnowledgeNode(input, services = {}) {
  if (!input || typeof input !== 'object') {
    return { ok: false, error: 'INVALID_INPUT' };
  }
  const type = String(input.type || '').toLowerCase();
  if (!utils.isValidNodeType(type)) {
    return { ok: false, error: 'INVALID_NODE_TYPE' };
  }
  const sensitivity = utils.isValidSensitivity(input.sensitivity) ? input.sensitivity : 'internal';
  if (sensitivity === 'secret') {
    return { ok: false, error: 'SECRET_SENSITIVITY_NOT_ALLOWED' };
  }
  const rawText = `${input.summary || ''} ${input.title || ''}`;
  const secretCheck = utils.detectSecretInText(rawText);
  if (secretCheck.found) {
    return { ok: false, error: 'SECRET_IN_CONTENT', redaction: utils.REDACTION_PLACEHOLDER };
  }
  const text = utils.sanitizeString(input.summary || input.title || '');
  const node = {
    id: input.id || generateNodeId(),
    workspaceId: String(input.workspaceId || services.workspaceId || 'default').slice(0, 100),
    type,
    title: utils.safeStr(input.title || 'Untitled', 200),
    summary: utils.safeStr(text, 1000),
    tags: utils.safeArray(input.tags).slice(0, 20).map(t => utils.safeStr(t, 50)),
    source: utils.safeStr(input.source || 'manual', 80),
    sourceId: utils.safeStr(input.sourceId || '', 120),
    sensitivity,
    confidence: Number.isFinite(input.confidence) ? Math.max(0, Math.min(1, input.confidence)) : 0.7,
    status: utils.VALID_STATUS.includes(input.status) ? input.status : 'active',
    metadata: utils.redactObject(input.metadata || {}),
    createdAt: utils.nowIso(),
    updatedAt: utils.nowIso()
  };
  nodes.push(node);
  recordAudit({ type: 'node_created', nodeId: node.id, nodeType: node.type, source: node.source }, services);
  return { ok: true, node };
}

function updateKnowledgeNode(id, patch, services = {}) {
  const node = getKnowledgeNode(id, services);
  if (!node) return { ok: false, error: 'NODE_NOT_FOUND' };
  if (utils.isProtectedDecisionTitle(node.title) && patch.title && patch.title !== node.title) {
    return { ok: false, error: 'PROTECTED_DECISION' };
  }
  if (patch.type && !utils.isValidNodeType(patch.type)) {
    return { ok: false, error: 'INVALID_NODE_TYPE' };
  }
  if (patch.sensitivity && !utils.isValidSensitivity(patch.sensitivity)) {
    return { ok: false, error: 'INVALID_SENSITIVITY' };
  }
  if (patch.sensitivity === 'secret') {
    return { ok: false, error: 'SECRET_SENSITIVITY_NOT_ALLOWED' };
  }
  if (patch.title || patch.summary) {
    const testText = utils.sanitizeString(patch.summary || patch.title || '');
    const secretCheck = utils.detectSecretInText(testText);
    if (secretCheck.found) {
      return { ok: false, error: 'SECRET_IN_CONTENT', redaction: utils.REDACTION_PLACEHOLDER };
    }
  }
  if (patch.title) node.title = utils.safeStr(patch.title, 200);
  if (patch.summary !== undefined) node.summary = utils.safeStr(utils.sanitizeString(patch.summary), 1000);
  if (patch.tags) node.tags = utils.safeArray(patch.tags).slice(0, 20).map(t => utils.safeStr(t, 50));
  if (patch.type) node.type = patch.type;
  if (patch.sensitivity) node.sensitivity = patch.sensitivity;
  if (patch.confidence !== undefined && Number.isFinite(patch.confidence)) {
    node.confidence = Math.max(0, Math.min(1, patch.confidence));
  }
  if (patch.status && utils.VALID_STATUS.includes(patch.status)) node.status = patch.status;
  if (patch.metadata) node.metadata = utils.redactObject(patch.metadata);
  node.updatedAt = utils.nowIso();
  recordAudit({ type: 'node_updated', nodeId: node.id }, services);
  return { ok: true, node };
}

function getKnowledgeNode(id, services = {}) {
  if (!id) return null;
  return nodes.find(n => n.id === id) || null;
}

function listKnowledgeNodes(filters = {}, services = {}) {
  let result = [...nodes];
  if (filters.workspaceId) result = result.filter(n => n.workspaceId === filters.workspaceId);
  if (filters.type) result = result.filter(n => n.type === filters.type);
  if (filters.status) result = result.filter(n => n.status === filters.status);
  if (filters.sensitivity) result = result.filter(n => n.sensitivity === filters.sensitivity);
  if (filters.source) result = result.filter(n => n.source === filters.source);
  if (filters.tag) result = result.filter(n => (n.tags || []).includes(filters.tag));
  if (filters.search) {
    const q = String(filters.search).toLowerCase();
    result = result.filter(n =>
      (n.title || '').toLowerCase().includes(q) ||
      (n.summary || '').toLowerCase().includes(q)
    );
  }
  result.sort((a, b) => a.updatedAt < b.updatedAt ? 1 : -1);
  const limit = utils.clampLimit(filters.limit, 100, 500);
  return result.slice(0, limit);
}

function archiveKnowledgeNode(id, reason, services = {}) {
  const node = getKnowledgeNode(id, services);
  if (!node) return { ok: false, error: 'NODE_NOT_FOUND' };
  if (utils.isProtectedDecisionTitle(node.title) && node.type === 'decision') {
    return { ok: false, error: 'PROTECTED_DECISION' };
  }
  node.status = 'archived';
  node.archivedAt = utils.nowIso();
  node.archiveReason = utils.safeStr(reason || 'manual', 200);
  node.updatedAt = utils.nowIso();
  recordAudit({ type: 'node_archived', nodeId: node.id, reason: node.archiveReason }, services);
  return { ok: true, node };
}

function createKnowledgeEdge(input, services = {}) {
  if (!input || typeof input !== 'object') {
    return { ok: false, error: 'INVALID_INPUT' };
  }
  const relation = String(input.relation || '').toLowerCase();
  if (!utils.isValidRelation(relation)) {
    return { ok: false, error: 'INVALID_RELATION' };
  }
  const from = String(input.fromNodeId || '');
  const to = String(input.toNodeId || '');
  if (!from || !to) return { ok: false, error: 'MISSING_NODE_ID' };
  if (from === to) return { ok: false, error: 'SELF_LOOP_NOT_ALLOWED' };
  const fromNode = getKnowledgeNode(from, services);
  const toNode = getKnowledgeNode(to, services);
  if (!fromNode || !toNode) return { ok: false, error: 'NODE_NOT_FOUND' };
  const existing = edges.find(e => e.fromNodeId === from && e.toNodeId === to && e.relation === relation);
  if (existing) {
    return { ok: true, edge: existing, deduplicated: true };
  }
  const edge = {
    id: input.id || generateEdgeId(),
    workspaceId: String(input.workspaceId || fromNode.workspaceId || 'default').slice(0, 100),
    fromNodeId: from,
    toNodeId: to,
    relation,
    confidence: Number.isFinite(input.confidence) ? Math.max(0, Math.min(1, input.confidence)) : 0.7,
    source: utils.safeStr(input.source || 'manual', 80),
    evidence: utils.safeStr(utils.sanitizeString(input.evidence || ''), 500),
    createdAt: utils.nowIso()
  };
  edges.push(edge);
  recordAudit({ type: 'edge_created', edgeId: edge.id, relation }, services);
  return { ok: true, edge };
}

function listKnowledgeEdges(filters = {}, services = {}) {
  let result = [...edges];
  if (filters.workspaceId) result = result.filter(e => e.workspaceId === filters.workspaceId);
  if (filters.fromNodeId) result = result.filter(e => e.fromNodeId === filters.fromNodeId);
  if (filters.toNodeId) result = result.filter(e => e.toNodeId === filters.toNodeId);
  if (filters.relation) result = result.filter(e => e.relation === filters.relation);
  if (filters.nodeId) {
    result = result.filter(e => e.fromNodeId === filters.nodeId || e.toNodeId === filters.nodeId);
  }
  const limit = utils.clampLimit(filters.limit, 200, 1000);
  return result.slice(0, limit);
}

function getGraphAroundNode(nodeId, depth = 1, services = {}) {
  const root = getKnowledgeNode(nodeId, services);
  if (!root) return { ok: false, error: 'NODE_NOT_FOUND' };
  const maxDepth = Math.max(0, Math.min(3, parseInt(depth, 10) || 1));
  const visited = new Set([nodeId]);
  const collectedEdges = [];
  const collectedNodes = [root];
  let frontier = [nodeId];
  for (let d = 0; d < maxDepth; d++) {
    const next = [];
    for (const id of frontier) {
      const related = edges.filter(e => e.fromNodeId === id || e.toNodeId === id);
      for (const e of related) {
        collectedEdges.push(e);
        const otherId = e.fromNodeId === id ? e.toNodeId : e.fromNodeId;
        if (!visited.has(otherId)) {
          visited.add(otherId);
          const n = getKnowledgeNode(otherId, services);
          if (n && n.status !== 'archived') {
            collectedNodes.push(n);
            next.push(otherId);
          }
        }
      }
    }
    frontier = next;
  }
  return { ok: true, root, nodes: collectedNodes, edges: collectedEdges, depth: maxDepth };
}

function searchKnowledgeGraph(query, services = {}) {
  if (!query) return { ok: true, nodes: [], edges: [] };
  const q = String(query).toLowerCase();
  const matchedNodes = nodes.filter(n =>
    (n.title || '').toLowerCase().includes(q) ||
    (n.summary || '').toLowerCase().includes(q) ||
    (n.tags || []).some(t => t.toLowerCase().includes(q))
  );
  const matchedIds = new Set(matchedNodes.map(n => n.id));
  const matchedEdges = edges.filter(e => matchedIds.has(e.fromNodeId) || matchedIds.has(e.toNodeId));
  return { ok: true, nodes: matchedNodes, edges: matchedEdges, query };
}

function recordAudit(entry, services = {}) {
  const record = {
    id: utils.safeId('ka', idCounter++),
    type: String(entry.type || 'unknown'),
    nodeId: entry.nodeId || null,
    edgeId: entry.edgeId || null,
    relation: entry.relation || null,
    reason: entry.reason || null,
    source: entry.source || 'runtime',
    at: utils.nowIso()
  };
  auditLog.push(record);
  if (auditLog.length > 1000) auditLog = auditLog.slice(-500);
}

function getAuditLog(filters = {}) {
  let result = [...auditLog];
  if (filters.type) result = result.filter(a => a.type === filters.type);
  if (filters.nodeId) result = result.filter(a => a.nodeId === filters.nodeId);
  return result.slice(-utils.clampLimit(filters.limit, 100, 500));
}

function reset() {
  nodes = [];
  edges = [];
  auditLog = [];
  idCounter = 1;
}

function stats() {
  return {
    totalNodes: nodes.length,
    totalEdges: edges.length,
    activeNodes: nodes.filter(n => n.status === 'active').length,
    archivedNodes: nodes.filter(n => n.status === 'archived').length,
    byType: nodes.reduce((acc, n) => { acc[n.type] = (acc[n.type] || 0) + 1; return acc; }, {}),
    byRelation: edges.reduce((acc, e) => { acc[e.relation] = (acc[e.relation] || 0) + 1; return acc; }, {}),
    auditEntries: auditLog.length
  };
}

module.exports = {
  createKnowledgeNode,
  updateKnowledgeNode,
  getKnowledgeNode,
  listKnowledgeNodes,
  archiveKnowledgeNode,
  createKnowledgeEdge,
  listKnowledgeEdges,
  getGraphAroundNode,
  searchKnowledgeGraph,
  getAuditLog,
  reset,
  stats
};

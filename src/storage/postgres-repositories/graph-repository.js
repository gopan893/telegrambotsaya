'use strict';

const {
  clampNumber,
  createId,
  ensureUserRow,
  jsonObject,
  normalizeLimit
} = require('./repository-utils');

function mapNode(row = {}) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    label: row.label,
    type: row.type,
    summary: row.summary,
    importance: Number(row.importance ?? 0.5),
    confidence: Number(row.confidence ?? 0.5),
    source: row.source,
    metadata: row.metadata || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastSeenAt: row.last_seen_at,
    deletedAt: row.deleted_at
  };
}

function mapEdge(row = {}) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    fromNodeId: row.from_node_id,
    toNodeId: row.to_node_id,
    relationship: row.relationship,
    weight: Number(row.weight ?? 1),
    confidence: Number(row.confidence ?? 0.5),
    evidence: row.evidence,
    metadata: row.metadata || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at
  };
}

function createGraphRepository(pool) {
  async function upsertNode(node = {}) {
    const userId = await ensureUserRow(pool, node.userId || node.user_id);
    const result = await pool.query(
      `INSERT INTO graph_nodes(
        id, user_id, label, type, summary, importance, confidence, source, metadata,
        created_at, updated_at, last_seen_at
      )
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,NOW(),NOW(),NOW())
      ON CONFLICT(id) DO UPDATE SET
        label = EXCLUDED.label,
        type = EXCLUDED.type,
        summary = EXCLUDED.summary,
        importance = EXCLUDED.importance,
        confidence = EXCLUDED.confidence,
        source = EXCLUDED.source,
        metadata = EXCLUDED.metadata,
        updated_at = NOW(),
        last_seen_at = NOW(),
        deleted_at = NULL
      RETURNING *`,
      [
        node.id || createId('node'),
        userId,
        String(node.label || '').slice(0, 240),
        node.type || 'concept',
        node.summary || null,
        clampNumber(node.importance, 0.5),
        clampNumber(node.confidence, 0.5),
        node.source || null,
        JSON.stringify(jsonObject(node.metadata))
      ]
    );
    return mapNode(result.rows[0]);
  }

  async function listNodes(userId, options = {}) {
    const limit = normalizeLimit(options.limit, 25, 100);
    const type = options.type || null;
    const result = await pool.query(
      `SELECT * FROM graph_nodes
       WHERE user_id = $1
         AND deleted_at IS NULL
         AND ($2::text IS NULL OR type = $2)
       ORDER BY importance DESC, last_seen_at DESC
       LIMIT $3`,
      [String(userId), type, limit]
    );
    return result.rows.map(mapNode);
  }

  async function getNodeById(userId, nodeId) {
    const result = await pool.query(
      `UPDATE graph_nodes SET last_seen_at = NOW(), updated_at = NOW()
       WHERE user_id = $1 AND id = $2 AND deleted_at IS NULL
       RETURNING *`,
      [String(userId), String(nodeId)]
    );
    return mapNode(result.rows[0]);
  }

  async function createEdge(edge = {}) {
    const userId = await ensureUserRow(pool, edge.userId || edge.user_id);
    const result = await pool.query(
      `INSERT INTO graph_edges(
        id, user_id, from_node_id, to_node_id, relationship, weight, confidence,
        evidence, metadata, created_at, updated_at
      )
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,NOW(),NOW())
      ON CONFLICT(id) DO UPDATE SET
        relationship = EXCLUDED.relationship,
        weight = EXCLUDED.weight,
        confidence = EXCLUDED.confidence,
        evidence = EXCLUDED.evidence,
        metadata = EXCLUDED.metadata,
        updated_at = NOW(),
        deleted_at = NULL
      RETURNING *`,
      [
        edge.id || createId('edge'),
        userId,
        edge.fromNodeId || edge.from_node_id,
        edge.toNodeId || edge.to_node_id,
        edge.relationship || 'related_to',
        Number(edge.weight || 1),
        clampNumber(edge.confidence, 0.5),
        edge.evidence || null,
        JSON.stringify(jsonObject(edge.metadata))
      ]
    );
    return mapEdge(result.rows[0]);
  }

  async function listEdges(userId, options = {}) {
    const limit = normalizeLimit(options.limit, 50, 200);
    const relationship = options.relationship || null;
    const result = await pool.query(
      `SELECT * FROM graph_edges
       WHERE user_id = $1
         AND deleted_at IS NULL
         AND ($2::text IS NULL OR relationship = $2)
       ORDER BY weight DESC, confidence DESC, updated_at DESC
       LIMIT $3`,
      [String(userId), relationship, limit]
    );
    return result.rows.map(mapEdge);
  }

  async function getGraphSnapshot(userId, options = {}) {
    const nodes = await listNodes(userId, { limit: options.nodeLimit || 25, type: options.type });
    const edges = await listEdges(userId, { limit: options.edgeLimit || 50, relationship: options.relationship });
    return { nodes, edges };
  }

  async function softDeleteNode(userId, nodeId) {
    const result = await pool.query(
      `UPDATE graph_nodes SET deleted_at = NOW(), updated_at = NOW()
       WHERE user_id = $1 AND id = $2 AND deleted_at IS NULL
       RETURNING id`,
      [String(userId), String(nodeId)]
    );
    return { ok: Boolean(result.rows[0]), id: nodeId };
  }

  async function softDeleteEdge(userId, edgeId) {
    const result = await pool.query(
      `UPDATE graph_edges SET deleted_at = NOW(), updated_at = NOW()
       WHERE user_id = $1 AND id = $2 AND deleted_at IS NULL
       RETURNING id`,
      [String(userId), String(edgeId)]
    );
    return { ok: Boolean(result.rows[0]), id: edgeId };
  }

  return {
    createEdge,
    getGraphSnapshot,
    getNodeById,
    listEdges,
    listNodes,
    softDeleteEdge,
    softDeleteNode,
    upsertNode
  };
}

module.exports = {
  createGraphRepository,
  mapEdge,
  mapNode
};

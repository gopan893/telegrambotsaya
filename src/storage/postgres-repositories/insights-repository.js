'use strict';

const {
  clampNumber,
  createId,
  ensureUserRow,
  jsonObject,
  normalizeLimit,
  textArray
} = require('./repository-utils');

function mapInsight(row = {}) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    content: row.content,
    source: row.source,
    relatedConcepts: row.related_concepts || [],
    confidence: Number(row.confidence ?? 0.5),
    importance: Number(row.importance ?? 0.5),
    metadata: row.metadata || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at
  };
}

function createInsightsRepository(pool) {
  async function createInsight(insight = {}) {
    const userId = await ensureUserRow(pool, insight.userId || insight.user_id);
    const result = await pool.query(
      `INSERT INTO insights(
        id, user_id, type, content, source, related_concepts, confidence, importance,
        metadata, created_at, updated_at
      )
      VALUES($1,$2,$3,$4,$5,$6::text[],$7,$8,$9::jsonb,NOW(),NOW())
      ON CONFLICT(id) DO UPDATE SET
        type = EXCLUDED.type,
        content = EXCLUDED.content,
        source = EXCLUDED.source,
        related_concepts = EXCLUDED.related_concepts,
        confidence = EXCLUDED.confidence,
        importance = EXCLUDED.importance,
        metadata = EXCLUDED.metadata,
        updated_at = NOW(),
        deleted_at = NULL
      RETURNING *`,
      [
        insight.id || createId('insight'),
        userId,
        insight.type || 'insight',
        String(insight.content || insight.text || '').slice(0, 4000),
        insight.source || null,
        textArray(insight.relatedConcepts || insight.related_concepts || insight.tags),
        clampNumber(insight.confidence, 0.5),
        clampNumber(insight.importance, 0.5),
        JSON.stringify(jsonObject(insight.metadata))
      ]
    );
    return mapInsight(result.rows[0]);
  }

  async function listInsights(userId, options = {}) {
    const result = await pool.query(
      `SELECT * FROM insights
       WHERE user_id = $1 AND deleted_at IS NULL
       ORDER BY importance DESC, confidence DESC, updated_at DESC
       LIMIT $2`,
      [String(userId), normalizeLimit(options.limit, 10, 50)]
    );
    return result.rows.map(mapInsight);
  }

  async function searchInsights(userId, query = '', options = {}) {
    const q = String(query || '').trim();
    const pattern = `%${q.replace(/[%_]/g, '\\$&')}%`;
    const result = await pool.query(
      `SELECT * FROM insights
       WHERE user_id = $1
         AND deleted_at IS NULL
         AND ($2::text = '' OR content ILIKE $3 ESCAPE '\\' OR related_concepts::text ILIKE $3 ESCAPE '\\')
       ORDER BY importance DESC, confidence DESC, updated_at DESC
       LIMIT $4`,
      [String(userId), q, pattern, normalizeLimit(options.limit, 5, 20)]
    );
    return result.rows.map(mapInsight);
  }

  async function deleteInsight(userId, insightId) {
    const result = await pool.query(
      `UPDATE insights SET deleted_at = NOW(), updated_at = NOW()
       WHERE user_id = $1 AND id = $2 AND deleted_at IS NULL
       RETURNING id`,
      [String(userId), String(insightId)]
    );
    return { ok: Boolean(result.rows[0]), id: insightId };
  }

  return {
    createInsight,
    deleteInsight,
    listInsights,
    searchInsights
  };
}

module.exports = {
  createInsightsRepository,
  mapInsight
};

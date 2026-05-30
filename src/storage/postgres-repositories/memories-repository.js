'use strict';

const {
  clampNumber,
  createId,
  ensureUserRow,
  jsonObject,
  normalizeLimit,
  textArray
} = require('./repository-utils');

function mapMemory(row = {}) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    content: row.content,
    summary: row.summary,
    tags: row.tags || [],
    source: row.source,
    confidence: Number(row.confidence ?? 0.5),
    importance: Number(row.importance ?? 0.5),
    metadata: row.metadata || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastAccessedAt: row.last_accessed_at,
    expiresAt: row.expires_at,
    deletedAt: row.deleted_at
  };
}

function createMemoriesRepository(pool) {
  async function createMemory(memory = {}) {
    const userId = await ensureUserRow(pool, memory.userId || memory.user_id);
    const result = await pool.query(
      `INSERT INTO memories(
        id, user_id, type, content, summary, tags, source, confidence, importance,
        metadata, created_at, updated_at, last_accessed_at, expires_at
      )
      VALUES($1,$2,$3,$4,$5,$6::text[],$7,$8,$9,$10::jsonb,NOW(),NOW(),NOW(),$11)
      ON CONFLICT(id) DO UPDATE SET
        type = EXCLUDED.type,
        content = EXCLUDED.content,
        summary = EXCLUDED.summary,
        tags = EXCLUDED.tags,
        source = EXCLUDED.source,
        confidence = EXCLUDED.confidence,
        importance = EXCLUDED.importance,
        metadata = EXCLUDED.metadata,
        updated_at = NOW(),
        deleted_at = NULL
      RETURNING *`,
      [
        memory.id || createId('mem'),
        userId,
        memory.type || 'semantic',
        String(memory.content || memory.text || '').slice(0, 4000),
        memory.summary || null,
        textArray(memory.tags),
        memory.source || null,
        clampNumber(memory.confidence, 0.5),
        clampNumber(memory.importance, 0.5),
        JSON.stringify(jsonObject(memory.metadata)),
        memory.expiresAt || memory.expires_at || null
      ]
    );
    return mapMemory(result.rows[0]);
  }

  async function getMemoryById(userId, memoryId) {
    const result = await pool.query(
      `UPDATE memories
       SET last_accessed_at = NOW()
       WHERE user_id = $1 AND id = $2 AND deleted_at IS NULL
       RETURNING *`,
      [String(userId), String(memoryId)]
    );
    return mapMemory(result.rows[0]);
  }

  async function listMemories(userId, options = {}) {
    const limit = normalizeLimit(options.limit, 10, 20);
    const type = options.type || null;
    const result = await pool.query(
      `SELECT * FROM memories
       WHERE user_id = $1
         AND deleted_at IS NULL
         AND ($2::text IS NULL OR type = $2)
       ORDER BY importance DESC, confidence DESC, COALESCE(last_accessed_at, updated_at, created_at) DESC
       LIMIT $3`,
      [String(userId), type, limit]
    );
    return result.rows.map(mapMemory);
  }

  async function searchMemories(userId, query = '', options = {}) {
    const limit = normalizeLimit(options.limit || options.topK, 5, 20);
    const q = String(query || '').trim();
    const type = options.type || null;
    const pattern = `%${q.replace(/[%_]/g, '\\$&')}%`;
    const result = await pool.query(
      `SELECT * FROM memories
       WHERE user_id = $1
         AND deleted_at IS NULL
         AND ($2::text IS NULL OR type = $2)
         AND ($3::text = '' OR content ILIKE $4 ESCAPE '\\' OR summary ILIKE $4 ESCAPE '\\' OR tags::text ILIKE $4 ESCAPE '\\')
       ORDER BY importance DESC, confidence DESC, created_at DESC
       LIMIT $5`,
      [String(userId), type, q, pattern, limit]
    );
    return result.rows.map(mapMemory);
  }

  async function updateMemory(userId, memoryId, patch = {}) {
    const allowed = {
      type: 'type',
      content: 'content',
      summary: 'summary',
      source: 'source',
      confidence: 'confidence',
      importance: 'importance'
    };
    const sets = [];
    const params = [String(userId), String(memoryId)];

    for (const [key, column] of Object.entries(allowed)) {
      if (Object.prototype.hasOwnProperty.call(patch, key)) {
        params.push(patch[key]);
        sets.push(`${column} = $${params.length}`);
      }
    }
    if (patch.tags) {
      params.push(textArray(patch.tags));
      sets.push(`tags = $${params.length}::text[]`);
    }
    if (patch.metadata) {
      params.push(JSON.stringify(jsonObject(patch.metadata)));
      sets.push(`metadata = $${params.length}::jsonb`);
    }
    if (!sets.length) return getMemoryById(userId, memoryId);

    const result = await pool.query(
      `UPDATE memories SET ${sets.join(', ')}, updated_at = NOW()
       WHERE user_id = $1 AND id = $2 AND deleted_at IS NULL
       RETURNING *`,
      params
    );
    return mapMemory(result.rows[0]);
  }

  async function softDeleteMemory(userId, memoryId) {
    const result = await pool.query(
      `UPDATE memories SET deleted_at = NOW(), updated_at = NOW()
       WHERE user_id = $1 AND id = $2 AND deleted_at IS NULL
       RETURNING id`,
      [String(userId), String(memoryId)]
    );
    return { ok: Boolean(result.rows[0]), id: memoryId };
  }

  async function cleanupStaleMemories(userId, options = {}) {
    const maxAgeDays = Number(options.maxAgeDays || 180);
    const limit = normalizeLimit(options.limit, 50, 200);
    const result = await pool.query(
      `UPDATE memories SET deleted_at = NOW(), updated_at = NOW()
       WHERE id IN (
         SELECT id FROM memories
         WHERE user_id = $1
           AND deleted_at IS NULL
           AND importance < $2
           AND created_at < NOW() - ($3::int * INTERVAL '1 day')
         ORDER BY importance ASC, created_at ASC
         LIMIT $4
       )
       RETURNING id`,
      [String(userId), clampNumber(options.importanceBelow, 0.25), maxAgeDays, limit]
    );
    return { ok: true, count: result.rowCount, ids: result.rows.map(row => row.id) };
  }

  return {
    cleanupStaleMemories,
    createMemory,
    getMemoryById,
    listMemories,
    searchMemories,
    softDeleteMemory,
    updateMemory
  };
}

module.exports = {
  createMemoriesRepository,
  mapMemory
};

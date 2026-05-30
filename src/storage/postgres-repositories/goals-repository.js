'use strict';

const { createId, ensureUserRow, jsonObject, normalizeLimit } = require('./repository-utils');

const VALID_STATUS = new Set(['active', 'paused', 'completed', 'archived', 'cancelled']);
const VALID_PRIORITY = new Set(['low', 'medium', 'high', 'critical']);

function mapGoal(row = {}) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    progress: Number(row.progress || 0),
    targetDate: row.target_date,
    metadata: row.metadata || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
    deletedAt: row.deleted_at
  };
}

function normalizeStatus(status) {
  const value = String(status || 'active').toLowerCase();
  return VALID_STATUS.has(value) ? value : 'active';
}

function normalizePriority(priority) {
  const value = String(priority || 'medium').toLowerCase();
  return VALID_PRIORITY.has(value) ? value : 'medium';
}

function createGoalsRepository(pool) {
  async function createGoal(goal = {}) {
    const userId = await ensureUserRow(pool, goal.userId || goal.user_id);
    const result = await pool.query(
      `INSERT INTO goals(
        id, user_id, title, description, status, priority, progress, target_date, metadata,
        created_at, updated_at
      )
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,NOW(),NOW())
      ON CONFLICT(id) DO UPDATE SET
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        status = EXCLUDED.status,
        priority = EXCLUDED.priority,
        progress = EXCLUDED.progress,
        target_date = EXCLUDED.target_date,
        metadata = EXCLUDED.metadata,
        updated_at = NOW(),
        deleted_at = NULL
      RETURNING *`,
      [
        goal.id || createId('goal'),
        userId,
        String(goal.title || '').slice(0, 240),
        goal.description || null,
        normalizeStatus(goal.status),
        normalizePriority(goal.priority),
        Number(goal.progress || 0),
        goal.targetDate || goal.target_date || null,
        JSON.stringify(jsonObject(goal.metadata))
      ]
    );
    return mapGoal(result.rows[0]);
  }

  async function listGoals(userId, options = {}) {
    const limit = normalizeLimit(options.limit, 20, 50);
    const status = options.status || null;
    const result = await pool.query(
      `SELECT * FROM goals
       WHERE user_id = $1
         AND deleted_at IS NULL
         AND ($2::text IS NULL OR status = $2)
       ORDER BY
         CASE priority WHEN 'critical' THEN 4 WHEN 'high' THEN 3 WHEN 'medium' THEN 2 ELSE 1 END DESC,
         updated_at DESC
       LIMIT $3`,
      [String(userId), status, limit]
    );
    return result.rows.map(mapGoal);
  }

  async function getGoalById(userId, goalId) {
    const result = await pool.query(
      'SELECT * FROM goals WHERE user_id = $1 AND id = $2 AND deleted_at IS NULL LIMIT 1',
      [String(userId), String(goalId)]
    );
    return mapGoal(result.rows[0]);
  }

  async function updateGoal(userId, goalId, patch = {}) {
    const sets = [];
    const params = [String(userId), String(goalId)];
    const fieldMap = {
      title: 'title',
      description: 'description',
      status: 'status',
      priority: 'priority',
      progress: 'progress',
      targetDate: 'target_date'
    };

    for (const [key, column] of Object.entries(fieldMap)) {
      if (Object.prototype.hasOwnProperty.call(patch, key)) {
        let value = patch[key];
        if (key === 'status') value = normalizeStatus(value);
        if (key === 'priority') value = normalizePriority(value);
        params.push(value);
        sets.push(`${column} = $${params.length}`);
      }
    }
    if (patch.metadata) {
      params.push(JSON.stringify(jsonObject(patch.metadata)));
      sets.push(`metadata = $${params.length}::jsonb`);
    }
    if (!sets.length) return getGoalById(userId, goalId);

    const result = await pool.query(
      `UPDATE goals SET ${sets.join(', ')}, updated_at = NOW()
       WHERE user_id = $1 AND id = $2 AND deleted_at IS NULL
       RETURNING *`,
      params
    );
    return mapGoal(result.rows[0]);
  }

  async function softDeleteGoal(userId, goalId) {
    const result = await pool.query(
      `UPDATE goals SET deleted_at = NOW(), updated_at = NOW()
       WHERE user_id = $1 AND id = $2 AND deleted_at IS NULL
       RETURNING id`,
      [String(userId), String(goalId)]
    );
    return { ok: Boolean(result.rows[0]), id: goalId };
  }

  async function completeGoal(userId, goalId) {
    const result = await pool.query(
      `UPDATE goals
       SET status = 'completed', progress = 100, completed_at = NOW(), updated_at = NOW()
       WHERE user_id = $1 AND id = $2 AND deleted_at IS NULL
       RETURNING *`,
      [String(userId), String(goalId)]
    );
    return mapGoal(result.rows[0]);
  }

  return {
    completeGoal,
    createGoal,
    getGoalById,
    listGoals,
    softDeleteGoal,
    updateGoal
  };
}

module.exports = {
  createGoalsRepository,
  mapGoal
};

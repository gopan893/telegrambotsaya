'use strict';

const { createId, ensureUserRow, jsonObject, normalizeLimit } = require('./repository-utils');

const VALID_WORKFLOW_STATUS = new Set(['active', 'paused', 'completed', 'archived']);
const VALID_STEP_STATUS = new Set(['pending', 'active', 'done', 'skipped', 'blocked']);

function mapWorkflow(row = {}) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    goalId: row.goal_id,
    title: row.title,
    description: row.description,
    status: row.status,
    contextSummary: row.context_summary,
    metadata: row.metadata || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
    deletedAt: row.deleted_at
  };
}

function mapStep(row = {}) {
  if (!row) return null;
  return {
    id: row.id,
    workflowId: row.workflow_id,
    userId: row.user_id,
    stepNumber: row.step_number,
    title: row.title,
    description: row.description,
    status: row.status,
    result: row.result,
    metadata: row.metadata || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at
  };
}

function normalizeWorkflowStatus(status) {
  const value = String(status || 'active').toLowerCase();
  return VALID_WORKFLOW_STATUS.has(value) ? value : 'active';
}

function normalizeStepStatus(status) {
  const value = String(status || 'pending').toLowerCase();
  return VALID_STEP_STATUS.has(value) ? value : 'pending';
}

function createWorkflowsRepository(pool) {
  async function createWorkflow(workflow = {}) {
    const userId = await ensureUserRow(pool, workflow.userId || workflow.user_id);
    const result = await pool.query(
      `INSERT INTO workflows(
        id, user_id, goal_id, title, description, status, context_summary, metadata,
        created_at, updated_at
      )
      VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,NOW(),NOW())
      ON CONFLICT(id) DO UPDATE SET
        goal_id = EXCLUDED.goal_id,
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        status = EXCLUDED.status,
        context_summary = EXCLUDED.context_summary,
        metadata = EXCLUDED.metadata,
        updated_at = NOW(),
        deleted_at = NULL
      RETURNING *`,
      [
        workflow.id || createId('wf'),
        userId,
        workflow.goalId || workflow.goal_id || null,
        String(workflow.title || '').slice(0, 240),
        workflow.description || null,
        normalizeWorkflowStatus(workflow.status),
        workflow.contextSummary || workflow.context_summary || null,
        JSON.stringify(jsonObject(workflow.metadata))
      ]
    );
    const created = mapWorkflow(result.rows[0]);

    if (Array.isArray(workflow.steps)) {
      for (const step of workflow.steps.slice(0, 50)) {
        await addWorkflowStep({
          ...step,
          userId,
          workflowId: created.id
        });
      }
    }

    return created;
  }

  async function listWorkflows(userId, options = {}) {
    const limit = normalizeLimit(options.limit, 20, 100);
    const status = options.status || null;
    const result = await pool.query(
      `SELECT * FROM workflows
       WHERE user_id = $1
         AND deleted_at IS NULL
         AND ($2::text IS NULL OR status = $2)
       ORDER BY updated_at DESC
       LIMIT $3`,
      [String(userId), status, limit]
    );
    return result.rows.map(mapWorkflow);
  }

  async function getWorkflowById(userId, workflowId) {
    const result = await pool.query(
      'SELECT * FROM workflows WHERE user_id = $1 AND id = $2 AND deleted_at IS NULL LIMIT 1',
      [String(userId), String(workflowId)]
    );
    return mapWorkflow(result.rows[0]);
  }

  async function updateWorkflow(userId, workflowId, patch = {}) {
    const sets = [];
    const params = [String(userId), String(workflowId)];
    const fieldMap = {
      goalId: 'goal_id',
      title: 'title',
      description: 'description',
      status: 'status',
      contextSummary: 'context_summary'
    };
    for (const [key, column] of Object.entries(fieldMap)) {
      if (Object.prototype.hasOwnProperty.call(patch, key)) {
        let value = patch[key];
        if (key === 'status') value = normalizeWorkflowStatus(value);
        params.push(value);
        sets.push(`${column} = $${params.length}`);
      }
    }
    if (patch.metadata) {
      params.push(JSON.stringify(jsonObject(patch.metadata)));
      sets.push(`metadata = $${params.length}::jsonb`);
    }
    if (!sets.length) return getWorkflowById(userId, workflowId);

    const result = await pool.query(
      `UPDATE workflows SET ${sets.join(', ')}, updated_at = NOW()
       WHERE user_id = $1 AND id = $2 AND deleted_at IS NULL
       RETURNING *`,
      params
    );
    return mapWorkflow(result.rows[0]);
  }

  async function addWorkflowStep(step = {}) {
    const userId = await ensureUserRow(pool, step.userId || step.user_id);
    const workflowId = String(step.workflowId || step.workflow_id || '');
    const workflowExists = await pool.query(
      'SELECT 1 FROM workflows WHERE user_id = $1 AND id = $2 AND deleted_at IS NULL LIMIT 1',
      [userId, workflowId]
    );
    if (!workflowExists.rows[0]) return null;
    let stepNumber = Number(step.stepNumber || step.step_number || 0);
    if (!stepNumber) {
      const max = await pool.query(
        'SELECT COALESCE(MAX(step_number), 0) + 1 AS next_number FROM workflow_steps WHERE workflow_id = $1',
        [workflowId]
      );
      stepNumber = Number(max.rows[0]?.next_number || 1);
    }

    const result = await pool.query(
      `INSERT INTO workflow_steps(
        id, workflow_id, user_id, step_number, title, description, status, result, metadata,
        created_at, updated_at, completed_at
      )
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,NOW(),NOW(),$10)
      ON CONFLICT(workflow_id, step_number) DO UPDATE SET
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        status = EXCLUDED.status,
        result = EXCLUDED.result,
        metadata = EXCLUDED.metadata,
        completed_at = EXCLUDED.completed_at,
        updated_at = NOW()
      RETURNING *`,
      [
        step.id || createId('step'),
        workflowId,
        userId,
        stepNumber,
        String(step.title || step.text || '').slice(0, 240),
        step.description || null,
        normalizeStepStatus(step.status || (step.done ? 'done' : 'pending')),
        step.result || null,
        JSON.stringify(jsonObject(step.metadata)),
        step.completedAt || step.completed_at || (step.done ? new Date().toISOString() : null)
      ]
    );
    return mapStep(result.rows[0]);
  }

  async function listWorkflowSteps(userId, workflowId) {
    const result = await pool.query(
      `SELECT * FROM workflow_steps
       WHERE user_id = $1 AND workflow_id = $2
       ORDER BY step_number ASC
       LIMIT 100`,
      [String(userId), String(workflowId)]
    );
    return result.rows.map(mapStep);
  }

  async function completeWorkflowStep(userId, workflowId, stepNumber) {
    const result = await pool.query(
      `UPDATE workflow_steps
       SET status = 'done', completed_at = NOW(), updated_at = NOW()
       WHERE user_id = $1 AND workflow_id = $2 AND step_number = $3
       RETURNING *`,
      [String(userId), String(workflowId), Number(stepNumber)]
    );
    return mapStep(result.rows[0]);
  }

  async function softDeleteWorkflow(userId, workflowId) {
    const result = await pool.query(
      `UPDATE workflows SET deleted_at = NOW(), updated_at = NOW()
       WHERE user_id = $1 AND id = $2 AND deleted_at IS NULL
       RETURNING id`,
      [String(userId), String(workflowId)]
    );
    return { ok: Boolean(result.rows[0]), id: workflowId };
  }

  return {
    addWorkflowStep,
    completeWorkflowStep,
    createWorkflow,
    getWorkflowById,
    listWorkflowSteps,
    listWorkflows,
    softDeleteWorkflow,
    updateWorkflow
  };
}

module.exports = {
  createWorkflowsRepository,
  mapStep,
  mapWorkflow
};

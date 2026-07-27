'use strict';

const store = require('./recipe-store');

function canRollback(recipeId, executionIndex) {
  const log = store.getAllExecutionLogs(200);
  const target = log.filter(l => l.recipeId === recipeId);
  if (!target[executionIndex]) return { ok: false, error: 'Execution not found' };
  return { ok: true, execution: target[executionIndex] };
}

function rollbackExecution(recipeId, executionIndex) {
  const check = canRollback(recipeId, executionIndex);
  if (!check.ok) return check;
  const log = store.getExecutionLog(recipeId);
  return { ok: true, message: 'Rollback not supported for this execution type', executions: log.length > 0 ? [log[log.length - 1]] : [] };
}

function getUndoPlan(recipeId, failedAction) {
  const recipe = store.getRecipe(recipeId);
  if (!recipe) return { ok: false, error: 'Recipe not found' };
  const actions = recipe.actions || [];
  const failedIndex = actions.findIndex(a => a.type === failedAction);
  if (failedIndex === -1) return { ok: false, error: 'Action not found in recipe' };
  const completedActions = actions.slice(0, failedIndex);
  const reversals = completedActions.reverse().map(a => ({
    originalAction: a.type,
    reversalType: getReversalType(a.type),
    reversible: Boolean(getReversalType(a.type))
  }));
  return { ok: true, recipeId, failedAction, failedIndex, reversals, fullyReversible: reversals.every(r => r.reversible) };
}

function getReversalType(actionType) {
  const reversalMap = {
    create_memory: 'delete_memory',
    create_goal: 'archive_goal',
    create_insight: 'archive_insight',
    send_message: null,
    send_notification: null,
    log_event: null,
    http_request: null
  };
  return reversalMap[actionType] || null;
}

module.exports = { canRollback, rollbackExecution, getUndoPlan };

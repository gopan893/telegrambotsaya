'use strict';

async function forkExecution(actions, context = {}) {
  const results = await Promise.allSettled(actions.map((action, i) => executeAction(action, i, context)));
  return results.map((r, i) => {
    if (r.status === 'fulfilled') return { actionIndex: i, action: actions[i].type, status: 'completed', result: r.value };
    return { actionIndex: i, action: actions[i].type, status: 'error', error: r.reason?.message || 'Unknown error' };
  });
}

async function executeAction(action, index, context) {
  return { action: action.type, index, simulated: true, context };
}

function mergeParallelResults(results) {
  const completed = results.filter(r => r.status === 'completed');
  const errors = results.filter(r => r.status === 'error');
  return {
    total: results.length,
    completed: completed.length,
    failed: errors.length,
    completedActions: completed.map(r => ({ index: r.actionIndex, type: r.action })),
    errors: errors.map(r => ({ index: r.actionIndex, type: r.action, error: r.error }))
  };
}

module.exports = { forkExecution, mergeParallelResults };

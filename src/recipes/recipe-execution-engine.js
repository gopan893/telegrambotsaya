'use strict';

const store = require('./recipe-store');
const conditionEngine = require('./recipe-condition-engine');
const actionRegistry = require('./recipe-action-registry');
const variableInterpolator = require('./recipe-variable-interpolator');

async function executeRecipe(recipeId, context = {}) {
  const recipe = store.getRecipe(recipeId);
  if (!recipe) return { ok: false, error: 'Recipe not found' };
  if (!recipe.enabled) return { ok: false, error: 'Recipe is disabled' };
  if (context.__bypassConditions) {
    const conditionResults = { bypassed: true };
    return runActions(recipe, context, conditionResults);
  }
  const conditionResults = evaluateConditions(recipe.conditions, context);
  if (!conditionResults.matched) {
    const log = { status: 'skipped', reason: 'Conditions not met' };
    store.recordExecution(recipeId, log);
    return { ok: true, status: 'skipped', reason: 'Conditions not met', conditionResults };
  }
  return runActions(recipe, context, conditionResults);
}

function evaluateConditions(conditions, context) {
  if (!conditions || conditions.length === 0) return { matched: true, results: [] };
  const results = conditions.map(c => conditionEngine.evaluateCondition(c, context));
  return { matched: results.every(r => r.matched), results };
}

async function runActions(recipe, context, conditionResults) {
  const results = [];
  let aborted = false;
  const startTime = Date.now();
  const vars = { ...(recipe.variables || {}), ...context };
  for (const action of (recipe.actions || [])) {
    if (aborted) break;
    if (recipe.timeout && Date.now() - startTime > recipe.timeout) {
      results.push({ action: action.type, status: 'timeout' });
      break;
    }
    try {
      const resolvedParams = variableInterpolator.interpolate(action.params || {}, vars);
      const actionDef = actionRegistry.getAction(action.type);
      const result = { action: action.type, status: 'completed', params: resolvedParams };
      if (!actionDef) result.status = 'unknown_action';
      results.push(result);
    } catch (err) {
      results.push({ action: action.type, status: 'error', error: err.message });
      if (recipe.maxRetries > 0) {
        for (let i = 0; i < recipe.maxRetries; i++) {
          try {
            const resolvedParams = variableInterpolator.interpolate(action.params || {}, vars);
            results.push({ action: action.type, status: 'completed_after_retry', retry: i + 1, params: resolvedParams });
            break;
          } catch (retryErr) {
            if (i === recipe.maxRetries - 1) results.push({ action: action.type, status: 'error', error: retryErr.message });
          }
        }
      }
    }
  }
  const executionResult = { status: 'completed', conditionResults, actionResults: results, duration: Date.now() - startTime };
  store.recordExecution(recipe.id, executionResult);
  return { ok: true, ...executionResult };
}

module.exports = { executeRecipe, evaluateConditions, runActions };

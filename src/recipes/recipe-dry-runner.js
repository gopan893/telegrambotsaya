'use strict';

const store = require('./recipe-store');
const conditionEngine = require('./recipe-condition-engine');
const actionRegistry = require('./recipe-action-registry');
const variableInterpolator = require('./recipe-variable-interpolator');

async function dryRunRecipe(recipeId, context = {}) {
  const recipe = store.getRecipe(recipeId);
  if (!recipe) return { ok: false, error: 'Recipe not found' };
  const conditionResults = recipe.conditions.length > 0
    ? recipe.conditions.map(c => conditionEngine.evaluateCondition(c, context))
    : [{ matched: true }];
  const conditionsMet = conditionResults.every(r => r.matched);
  const simulatedActions = (recipe.actions || []).map(action => {
    const def = actionRegistry.getAction(action.type);
    const resolvedParams = variableInterpolator.interpolate(action.params || {}, { ...context, ...(recipe.variables || {}) });
    return {
      type: action.type,
      name: def ? def.name : 'Unknown',
      params: resolvedParams,
      wouldExecute: conditionsMet
    };
  });
  return {
    ok: true,
    recipeId: recipe.id,
    recipeName: recipe.name,
    enabled: recipe.enabled,
    conditionsMet,
    conditionDetails: conditionResults,
    actionCount: simulatedActions.length,
    simulatedActions,
    warnings: []
  };
}

module.exports = { dryRunRecipe };

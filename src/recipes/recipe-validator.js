'use strict';

const triggerRegistry = require('./recipe-trigger-registry');
const actionRegistry = require('./recipe-action-registry');

function validateRecipe(recipe) {
  const errors = [];
  if (!recipe.name || typeof recipe.name !== 'string') errors.push('Recipe name is required');
  if (!recipe.trigger) errors.push('Recipe trigger is required');
  else if (!triggerRegistry.getTrigger(recipe.trigger.type)) errors.push(`Unknown trigger type: ${recipe.trigger.type}`);
  if (!recipe.actions || !Array.isArray(recipe.actions) || recipe.actions.length === 0) {
    errors.push('Recipe must have at least one action');
  } else {
    for (let i = 0; i < recipe.actions.length; i++) {
      const action = recipe.actions[i];
      if (!action.type) errors.push(`Action ${i} missing type`);
      else if (!actionRegistry.getAction(action.type)) errors.push(`Unknown action type: ${action.type}`);
    }
  }
  if (recipe.conditions && !Array.isArray(recipe.conditions)) errors.push('Conditions must be an array');
  if (recipe.timeout && (typeof recipe.timeout !== 'number' || recipe.timeout < 0)) errors.push('Timeout must be a positive number');
  if (recipe.maxRetries && (typeof recipe.maxRetries !== 'number' || recipe.maxRetries < 0)) errors.push('maxRetries must be a positive number');
  return { valid: errors.length === 0, errors };
}

function validateTriggerConfig(trigger) {
  if (!trigger || !trigger.type) return { valid: false, errors: ['Trigger type required'] };
  const def = triggerRegistry.getTrigger(trigger.type);
  if (!def) return { valid: false, errors: [`Unknown trigger: ${trigger.type}`] };
  const triggerErrors = [];
  if (trigger.type === 'schedule' && !trigger.params?.cron) triggerErrors.push('Schedule trigger requires cron expression');
  if (trigger.type === 'webhook' && !trigger.params?.path) triggerErrors.push('Webhook trigger requires path');
  return { valid: triggerErrors.length === 0, errors: triggerErrors };
}

module.exports = { validateRecipe, validateTriggerConfig };

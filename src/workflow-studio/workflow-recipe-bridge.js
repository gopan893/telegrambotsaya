'use strict';

const store = require('./workflow-store');
const builder = require('./workflow-builder');

function convertRecipeToWorkflow(recipeId, context) {
  let recipeStore;
  try {
    recipeStore = require('../recipes/recipe-store');
  } catch (err) {
    return { ok: false, error: 'Recipe store not available' };
  }

  const recipe = recipeStore.getRecipe(recipeId);
  if (!recipe) return { ok: false, error: 'Recipe not found' };

  const steps = convertRecipeActions(recipe.actions || []);
  const trigger = convertRecipeTrigger(recipe.trigger);

  return builder.createWorkflowDraft({
    name: recipe.name + ' (from Recipe)',
    description: recipe.description || 'Converted from recipe: ' + recipe.id,
    trigger,
    steps,
    createdFrom: 'recipe:' + recipeId,
    riskLevel: assessRecipeRisk(recipe)
  });
}

function convertRecipeToWorkflowData(recipe) {
  if (!recipe) return null;
  const steps = convertRecipeActions(recipe.actions || []);
  const trigger = convertRecipeTrigger(recipe.trigger);
  return {
    name: recipe.name,
    description: recipe.description || '',
    trigger,
    steps,
    riskLevel: assessRecipeRisk(recipe)
  };
}

function convertRecipeActions(actions) {
  const steps = [];
  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
    const step = convertRecipeAction(action, i);
    if (step) steps.push(step);
  }
  return steps;
}

function convertRecipeAction(action, index) {
  if (!action || !action.type) return null;
  const id = `recipe_step_${index}_${Date.now().toString(36)}`;
  switch (action.type) {
    case 'send_message':
    case 'send_notification':
      return { id, type: 'notify', name: action.type, channel: action.params?.channel || 'telegram', message: action.params?.text || action.params?.body || '', params: action.params || {} };
    case 'create_memory':
    case 'create_goal':
    case 'create_insight':
      return { id, type: 'internal_write', name: action.type, target: action.type.replace('create_', ''), params: action.params || {} };
    case 'run_health_check':
      return { id, type: 'read', name: 'Health Check', source: 'health', params: action.params || {} };
    case 'run_research':
      return { id, type: 'rag_search', name: 'Research', query: action.params?.query || '', params: action.params || {} };
    case 'trigger_workflow':
      return { id, type: 'proposal', name: 'Trigger Workflow', params: action.params || {} };
    case 'export_data':
      return { id, type: 'internal_write', name: 'Export Data', target: 'export', params: action.params || {} };
    case 'call_connector':
    case 'http_request':
      return { id, type: 'external_read', name: action.type, target: action.params?.url || action.params?.connector || '', params: action.params || {} };
    case 'set_variable':
    case 'condition_branch':
    case 'delay':
      return { id, type: 'read', name: action.type, params: action.params || {} };
    case 'log_event':
      return { id, type: 'read', name: 'Log Event', source: 'log', params: action.params || {} };
    default:
      return { id, type: 'read', name: action.type, params: action.params || {} };
  }
}

function convertRecipeTrigger(trigger) {
  if (!trigger) return { type: 'manual' };
  switch (trigger.type) {
    case 'schedule':
      return { type: 'schedule', params: { cron: trigger.params?.cron } };
    case 'webhook':
      return { type: 'webhook', params: { path: trigger.params?.path } };
    case 'error_detected':
    case 'health_degraded':
      return { type: 'error', params: trigger.params };
    default:
      return { type: 'manual', params: trigger.params };
  }
}

function assessRecipeRisk(recipe) {
  const actions = recipe.actions || [];
  const hasExternal = actions.some(a => ['call_connector', 'http_request', 'export_data'].includes(a.type));
  const hasWrite = actions.some(a => ['create_memory', 'create_goal', 'create_insight'].includes(a.type));
  if (hasExternal) return 'high';
  if (hasWrite) return 'medium';
  return 'low';
}

function convertWorkflowToRecipe(workflowId) {
  const workflow = store.getWorkflow(workflowId);
  if (!workflow) return { ok: false, error: 'Workflow not found' };

  const actions = (workflow.steps || []).map(step => convertStepToRecipeAction(step)).filter(Boolean);
  const trigger = convertWorkflowTrigger(workflow.trigger);

  return {
    ok: true,
    recipe: {
      name: workflow.name,
      description: workflow.description,
      trigger,
      actions,
      tags: ['converted_from_workflow'],
      enabled: workflow.status !== 'disabled'
    }
  };
}

function convertStepToRecipeAction(step) {
  if (!step) return null;
  switch (step.type) {
    case 'notify':
      return { type: 'send_message', params: { channel: step.channel, text: step.message, ...step.params } };
    case 'internal_write':
      return { type: 'create_memory', params: { content: step.target, ...step.params } };
    case 'external_read':
      return { type: 'http_request', params: { url: step.target, ...step.params } };
    case 'rag_search':
      return { type: 'run_research', params: { query: step.query, ...step.params } };
    case 'read':
      return { type: 'run_health_check', params: step.params };
    default:
      return { type: 'log_event', params: { action: step.type, ...step.params } };
  }
}

function convertWorkflowTrigger(trigger) {
  if (!trigger) return { type: 'manual' };
  if (trigger.type === 'schedule') return { type: 'schedule', params: trigger.params };
  if (trigger.type === 'error' || trigger.type === 'health_degraded') return { type: 'error_detected', params: trigger.params };
  return { type: 'manual' };
}

module.exports = { convertRecipeToWorkflow, convertRecipeToWorkflowData, convertWorkflowToRecipe };

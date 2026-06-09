'use strict';

const recipes = new Map();
const executions = [];

function createRecipe(data) {
  const id = data.id || `recipe_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const recipe = {
    id,
    name: data.name || 'Untitled Recipe',
    description: data.description || '',
    trigger: data.trigger || { type: 'manual' },
    conditions: data.conditions || [],
    actions: data.actions || [],
    variables: data.variables || {},
    enabled: data.enabled !== false,
    tags: Array.isArray(data.tags) ? data.tags : [],
    parallel: data.parallel || false,
    maxRetries: data.maxRetries || 0,
    timeout: data.timeout || 30000,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastRun: null,
    runCount: 0
  };
  recipes.set(id, recipe);
  return recipe;
}

function getRecipe(recipeId) {
  return recipes.get(String(recipeId)) || null;
}

function updateRecipe(recipeId, updates) {
  const existing = recipes.get(String(recipeId));
  if (!existing) return null;
  const updated = { ...existing, ...updates, id: recipeId, updatedAt: new Date().toISOString() };
  recipes.set(recipeId, updated);
  return updated;
}

function removeRecipe(recipeId) {
  return recipes.delete(String(recipeId));
}

function listRecipes(filter = {}) {
  let arr = Array.from(recipes.values());
  if (filter.enabled !== undefined) arr = arr.filter(r => r.enabled === filter.enabled);
  if (filter.trigger) arr = arr.filter(r => r.trigger?.type === filter.trigger);
  if (filter.tag) arr = arr.filter(r => r.tags.includes(filter.tag));
  return arr;
}

function recordExecution(recipeId, result) {
  executions.push({ recipeId, ...result, timestamp: new Date().toISOString() });
  if (executions.length > 1000) executions.splice(0, executions.length - 1000);
  const recipe = recipes.get(String(recipeId));
  if (recipe) {
    recipe.lastRun = new Date().toISOString();
    recipe.runCount = (recipe.runCount || 0) + 1;
  }
}

function getExecutionLog(recipeId, limit = 20) {
  return executions.filter(e => e.recipeId === recipeId).slice(-limit);
}

function getAllExecutionLogs(limit = 50) {
  return executions.slice(-limit);
}

function getRecipeCount() {
  return recipes.size;
}

function resetStore() {
  recipes.clear();
  executions.length = 0;
}

module.exports = { createRecipe, getRecipe, updateRecipe, removeRecipe, listRecipes, recordExecution, getExecutionLog, getAllExecutionLogs, getRecipeCount, resetStore };

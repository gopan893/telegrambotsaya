'use strict';

function generateRecipeId(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 64) + '_' + Date.now().toString(36);
}

function formatRecipeSummary(recipe) {
  return `[${recipe.enabled ? 'ON' : 'OFF'}] ${recipe.name} (${recipe.trigger?.type || 'manual'}) — ${recipe.actions?.length || 0} actions, ${recipe.conditions?.length || 0} conditions`;
}

function estimateRecipeComplexity(recipe) {
  let score = 0;
  score += (recipe.actions?.length || 0) * 2;
  score += (recipe.conditions?.length || 0) * 3;
  if (recipe.parallel) score += 5;
  if (recipe.maxRetries > 0) score += 2;
  if (recipe.timeout && recipe.timeout < 10000) score += 3;
  return { score, level: score <= 5 ? 'simple' : score <= 15 ? 'moderate' : 'complex' };
}

function validateCronExpression(cron) {
  if (!cron || typeof cron !== 'string') return false;
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return false;
  return parts.every(p => /^(\*|\d+(-\d+)?(,\d+(-\d+)?)*|\d+\/\d+)$/.test(p));
}

module.exports = { generateRecipeId, formatRecipeSummary, estimateRecipeComplexity, validateCronExpression };

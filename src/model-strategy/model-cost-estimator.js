'use strict';

const utils = require('./model-strategy-utils');

const COST_TABLE = {
  'gpt-4o': { inputPer1k: 0.005, outputPer1k: 0.015, tier: 'high' },
  'gpt-4o-mini': { inputPer1k: 0.00015, outputPer1k: 0.0006, tier: 'low' },
  'gpt-3.5-turbo': { inputPer1k: 0.0005, outputPer1k: 0.0015, tier: 'low' },
  'claude-3-5-sonnet': { inputPer1k: 0.003, outputPer1k: 0.015, tier: 'high' },
  'claude-3-haiku': { inputPer1k: 0.00025, outputPer1k: 0.00125, tier: 'low' },
  'local-default': { inputPer1k: 0, outputPer1k: 0, tier: 'free' }
};

function estimateCost(task = {}, services = {}) {
  const text = String(task.input || task.description || '');
  const inputTokens = Math.ceil(text.split(/\s+/).length * 1.3);
  const outputTokens = Math.ceil(inputTokens * 0.5);
  const model = task.model || task.selectedModel || 'gpt-4o-mini';
  const costs = COST_TABLE[model] || COST_TABLE['gpt-4o-mini'];
  const inputCost = (inputTokens / 1000) * costs.inputPer1k;
  const outputCost = (outputTokens / 1000) * costs.outputPer1k;
  const totalCost = inputCost + outputCost;
  return {
    id: utils.createId('cost'),
    model,
    inputTokens,
    outputTokens,
    inputCost: +inputCost.toFixed(6),
    outputCost: +outputCost.toFixed(6),
    estimatedCost: +totalCost.toFixed(6),
    costTier: costs.tier,
    estimatedAt: new Date().toISOString()
  };
}

function estimateCostForModel(model, inputLength = 100, services = {}) {
  const costs = COST_TABLE[model] || COST_TABLE['gpt-4o-mini'];
  const inputTokens = Math.ceil(inputLength * 1.3);
  const outputTokens = Math.ceil(inputTokens * 0.5);
  const totalCost = (inputTokens / 1000) * costs.inputPer1k + (outputTokens / 1000) * costs.outputPer1k;
  return { model, estimatedCost: +totalCost.toFixed(6), costTier: costs.tier };
}

function compareModelCosts(models = [], inputLength = 100, services = {}) {
  return models.map(m => estimateCostForModel(m, inputLength, services)).sort((a, b) => a.estimatedCost - b.estimatedCost);
}

function isWithinBudget(estimatedCost = 0, budgetLimit = null, services = {}) {
  const limit = budgetLimit || services.budgetLimit || 0.1;
  return { within: estimatedCost <= limit, estimatedCost, limit, overBy: estimatedCost > limit ? +(estimatedCost - limit).toFixed(6) : 0 };
}

module.exports = { estimateCost, estimateCostForModel, compareModelCosts, isWithinBudget, COST_TABLE };

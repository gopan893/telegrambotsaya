'use strict';

const registry = require('./model-cost-registry');

function estimateCost(provider, model, inputTokens, outputTokens, services) {
  const costInfo = registry.getModelCost(provider, model);
  if (!costInfo.known) {
    return { estimatedCost: null, known: false, reason: 'model_price_unknown', inputTokens, outputTokens };
  }
  const inputCost = (inputTokens / 1000000) * costInfo.inputCostPerMillionTokens;
  const outputCost = (outputTokens / 1000000) * costInfo.outputCostPerMillionTokens;
  return {
    estimatedCost: inputCost + outputCost,
    known: true,
    inputCost,
    outputCost,
    inputTokens,
    outputTokens,
    provider,
    model
  };
}

function estimateWorkflowCost(workflow, services) {
  if (!workflow || !workflow.steps) {
    return { estimatedCost: null, known: false, reason: 'invalid_workflow' };
  }
  const estimator = require('./token-estimator');
  let totalCost = 0;
  let totalInput = 0;
  let totalOutput = 0;
  let unknownCount = 0;
  for (const step of workflow.steps) {
    const provider = step.provider || workflow.defaultProvider || 'openai';
    const model = step.model || workflow.defaultModel || 'gpt-4o-mini';
    const inputTokens = step.inputTokens || estimator.estimateTokensFromText(step.prompt || step.instruction || '').tokens;
    const outputTokens = step.outputTokens || estimator.estimateResponseTokens(step.type || 'simple').tokens;
    const cost = estimateCost(provider, model, inputTokens, outputTokens, services);
    if (cost.known) {
      totalCost += cost.estimatedCost;
      totalInput += inputTokens;
      totalOutput += outputTokens;
    } else {
      unknownCount++;
    }
  }
  return {
    estimatedCost: totalCost || null,
    known: unknownCount === 0,
    totalInputTokens: totalInput,
    totalOutputTokens: totalOutput,
    steps: workflow.steps.length,
    unknownSteps: unknownCount
  };
}

function estimateAgentRunCost(agentPlan, services) {
  if (!agentPlan) return { estimatedCost: null, known: false, reason: 'no_plan' };
  const estimator = require('./token-estimator');
  const provider = agentPlan.provider || 'openai';
  const model = agentPlan.model || 'gpt-4o-mini';
  const context = agentPlan.context || agentPlan.prompt || '';
  const inputTokens = agentPlan.inputTokens || estimator.estimateTokensFromText(context).tokens;
  const outputTokens = agentPlan.outputTokens || estimator.estimateResponseTokens(agentPlan.type || 'chat').tokens;
  return estimateCost(provider, model, inputTokens, outputTokens, services);
}

function estimateCouncilCost(councilPlan, services) {
  if (!councilPlan || !councilPlan.agents) {
    return { estimatedCost: null, known: false, reason: 'no_council_plan' };
  }
  let totalCost = 0;
  let unknownCount = 0;
  for (const agent of councilPlan.agents) {
    const cost = estimateAgentRunCost(agent, services);
    if (cost.known) {
      totalCost += cost.estimatedCost;
    } else {
      unknownCount++;
    }
  }
  return {
    estimatedCost: totalCost || null,
    known: unknownCount === 0,
    agentCount: councilPlan.agents.length,
    unknownAgents: unknownCount
  };
}

function estimateEvaluationSuiteCost(suite, services) {
  if (!suite || !suite.cases) {
    return { estimatedCost: null, known: false, reason: 'no_evaluation_suite' };
  }
  const estimator = require('./token-estimator');
  const provider = suite.provider || 'openai';
  const model = suite.model || 'gpt-4o-mini';
  let totalCost = 0;
  let unknownCount = 0;
  for (const testCase of suite.cases) {
    const inputTokens = estimator.estimateTokensFromText(testCase.input || testCase.prompt || '').tokens;
    const outputTokens = estimator.estimateResponseTokens('evaluation').tokens;
    const cost = estimateCost(provider, model, inputTokens, outputTokens, services);
    if (cost.known) {
      totalCost += cost.estimatedCost;
    } else {
      unknownCount++;
    }
  }
  return {
    estimatedCost: totalCost || null,
    known: unknownCount === 0,
    caseCount: suite.cases.length,
    unknownCases: unknownCount
  };
}

module.exports = {
  estimateCost,
  estimateWorkflowCost,
  estimateAgentRunCost,
  estimateCouncilCost,
  estimateEvaluationSuiteCost
};

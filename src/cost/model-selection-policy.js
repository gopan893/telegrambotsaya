'use strict';

const registry = require('./model-cost-registry');

let currentMode = 'balanced';
let policyOverrides = {};

const MODE_PRIORITY = { economy: 1, balanced: 2, quality: 3, local_first: 1, manual: 4 };

function getModePreference(mode) {
  const m = mode || currentMode;
  return MODE_PRIORITY[m] || 2;
}

function setModelSelectionMode(mode) {
  const validModes = Object.keys(MODE_PRIORITY);
  if (validModes.includes(mode)) {
    currentMode = mode;
    return { ok: true, mode };
  }
  return { ok: false, error: 'invalid_mode' };
}

function getCurrentMode() {
  return currentMode;
}

function selectModelForRequest(request, context, services) {
  const taskComplexity = (context && context.complexity) || request.complexity || 'low';
  const requestType = request.type || request.requestType || 'chat';
  const mode = request.mode || context?.mode || currentMode;
  const preferenceMap = {
    simple: 'economy',
    chat: 'economy',
    command: 'economy',
    analysis: 'balanced',
    coding: 'balanced',
    debug: 'quality',
    council: 'quality',
    debate: 'quality',
    evaluation: 'balanced',
    report: 'balanced',
    security: 'quality',
    risk_review: 'quality',
    external_write: 'reliable',
    deploy: 'reliable',
    rollback: 'reliable',
    default: 'balanced'
  };
  const taskPreference = preferenceMap[requestType] || preferenceMap.default;
  const taskUseMap = {
    simple: 'simple', chat: 'simple', command: 'simple',
    analysis: 'general', coding: 'reasoning', debug: 'reasoning',
    council: 'reasoning', debate: 'reasoning',
    evaluation: 'general', report: 'general',
    security: 'reasoning', risk_review: 'reasoning',
    external_write: 'reasoning', deploy: 'reasoning', rollback: 'reasoning'
  };
  const useCase = taskUseMap[requestType] || 'general';
  const minQuality = { economy: 'low', balanced: 'medium', quality: 'high', local_first: 'low', manual: 'medium', reliable: 'high' };
  const quality = minQuality[mode] || minQuality[taskPreference] || 'medium';
  const model = registry.findBestModelForTask(useCase, quality);
  return model ? {
    model: model.model,
    provider: model.provider,
    qualityTier: model.qualityTier,
    speedTier: model.speedTier,
    estimatedCostPerMillion: model.inputCostPerMillionTokens + model.outputCostPerMillionTokens,
    mode,
    reason: `mode=${mode}, task=${requestType}, complexity=${taskComplexity}`
  } : null;
}

function selectModelForAgent(agentId, task, services) {
  const agentOverride = policyOverrides[agentId];
  if (agentOverride && agentOverride.model) {
    const entry = registry.getModelEntry(agentOverride.provider, agentOverride.model);
    if (entry) {
      return {
        model: entry.model,
        provider: entry.provider,
        qualityTier: entry.qualityTier,
        speedTier: entry.speedTier,
        estimatedCostPerMillion: entry.inputCostPerMillionTokens + entry.outputCostPerMillionTokens,
        mode: 'manual',
        reason: `agent_override for ${agentId}`
      };
    }
  }
  const taskComplexity = task?.complexity || 'medium';
  const useCase = task?.type === 'coding' || task?.type === 'debug' ? 'reasoning' : 'general';
  const quality = task?.highQuality ? 'high' : (currentMode === 'economy' ? 'low' : 'medium');
  const model = registry.findBestModelForTask(useCase, quality);
  return model ? {
    model: model.model,
    provider: model.provider,
    qualityTier: model.qualityTier,
    speedTier: model.speedTier,
    estimatedCostPerMillion: model.inputCostPerMillionTokens + model.outputCostPerMillionTokens,
    mode: currentMode,
    reason: `agent=${agentId}, complexity=${taskComplexity}, mode=${currentMode}`
  } : null;
}

function selectModelForEvaluation(caseType, services) {
  const riskLevel = caseType === 'security' || caseType === 'critical' ? 'high' : 'medium';
  const useCase = riskLevel === 'high' ? 'reasoning' : 'general';
  const quality = riskLevel === 'high' ? 'high' : (currentMode === 'economy' ? 'low' : 'medium');
  const model = registry.findBestModelForTask(useCase, quality);
  return model ? {
    model: model.model,
    provider: model.provider,
    qualityTier: model.qualityTier,
    speedTier: model.speedTier,
    estimatedCostPerMillion: model.inputCostPerMillionTokens + model.outputCostPerMillionTokens,
    mode: currentMode,
    reason: `evaluation_${caseType}, risk=${riskLevel}, mode=${currentMode}`
  } : null;
}

function selectModelForCodingTask(task, services) {
  const complexity = task?.complexity || task?.difficulty || 'medium';
  const useCase = 'reasoning';
  const baseQuality = complexity === 'high' || complexity === 'critical' ? 'high' : 'medium';
  const quality = currentMode === 'economy' ? 'medium' : (currentMode === 'quality' ? 'high' : baseQuality);
  const model = registry.findBestModelForTask(useCase, quality);
  return model ? {
    model: model.model,
    provider: model.provider,
    qualityTier: model.qualityTier,
    speedTier: model.speedTier,
    estimatedCostPerMillion: model.inputCostPerMillionTokens + model.outputCostPerMillionTokens,
    mode: currentMode,
    reason: `coding, complexity=${complexity}, mode=${currentMode}`
  } : null;
}

function selectModelForRoutine(routine, services) {
  const taskType = routine?.type || 'simple';
  const useCase = taskType === 'analysis' || taskType === 'report' ? 'general' : 'simple';
  const quality = currentMode === 'economy' ? 'low' : 'medium';
  const model = registry.findBestModelForTask(useCase, quality);
  return model ? {
    model: model.model,
    provider: model.provider,
    qualityTier: model.qualityTier,
    speedTier: model.speedTier,
    estimatedCostPerMillion: model.inputCostPerMillionTokens + model.outputCostPerMillionTokens,
    mode: currentMode,
    reason: `routine_${taskType}, mode=${currentMode}`
  } : null;
}

function setPolicyOverride(agentId, override) {
  policyOverrides[agentId] = override;
  return { ok: true };
}

function clearPolicyOverride(agentId) {
  delete policyOverrides[agentId];
  return { ok: true };
}

function getPolicyOverrides() {
  return { ...policyOverrides };
}

module.exports = {
  setModelSelectionMode,
  getCurrentMode,
  selectModelForRequest,
  selectModelForAgent,
  selectModelForEvaluation,
  selectModelForCodingTask,
  selectModelForRoutine,
  setPolicyOverride,
  clearPolicyOverride,
  getPolicyOverrides,
  MODE_PRIORITY
};

'use strict';

const DEFAULT_MODELS = [
  { provider: 'openai', model: 'gpt-4o', inputCostPerMillionTokens: 2.50, outputCostPerMillionTokens: 10.00, contextWindow: 128000, qualityTier: 'high', speedTier: 'fast', defaultUseCase: 'complex', enabled: true },
  { provider: 'openai', model: 'gpt-4o-mini', inputCostPerMillionTokens: 0.15, outputCostPerMillionTokens: 0.60, contextWindow: 128000, qualityTier: 'medium', speedTier: 'fast', defaultUseCase: 'general', enabled: true },
  { provider: 'openai', model: 'o3-mini', inputCostPerMillionTokens: 1.10, outputCostPerMillionTokens: 4.40, contextWindow: 200000, qualityTier: 'high', speedTier: 'fast', defaultUseCase: 'reasoning', enabled: true },
  { provider: 'mistral', model: 'mistral-large-latest', inputCostPerMillionTokens: 2.00, outputCostPerMillionTokens: 6.00, contextWindow: 128000, qualityTier: 'high', speedTier: 'medium', defaultUseCase: 'complex', enabled: true },
  { provider: 'mistral', model: 'mistral-small-latest', inputCostPerMillionTokens: 0.20, outputCostPerMillionTokens: 0.60, contextWindow: 32000, qualityTier: 'medium', speedTier: 'fast', defaultUseCase: 'general', enabled: true },
  { provider: 'groq', model: 'llama-3.3-70b-versatile', inputCostPerMillionTokens: 0.59, outputCostPerMillionTokens: 0.79, contextWindow: 128000, qualityTier: 'high', speedTier: 'fast', defaultUseCase: 'general', enabled: true },
  { provider: 'groq', model: 'llama-3.1-8b-instant', inputCostPerMillionTokens: 0.05, outputCostPerMillionTokens: 0.08, contextWindow: 128000, qualityTier: 'low', speedTier: 'fast', defaultUseCase: 'simple', enabled: true },
  { provider: 'google', model: 'gemini-2.0-flash', inputCostPerMillionTokens: 0.10, outputCostPerMillionTokens: 0.40, contextWindow: 1000000, qualityTier: 'high', speedTier: 'fast', defaultUseCase: 'general', enabled: true },
  { provider: 'google', model: 'gemini-2.5-flash-preview', inputCostPerMillionTokens: 0.15, outputCostPerMillionTokens: 0.60, contextWindow: 1000000, qualityTier: 'high', speedTier: 'fast', defaultUseCase: 'reasoning', enabled: true },
  { provider: 'google', model: 'gemini-2.0-flash-lite', inputCostPerMillionTokens: 0.075, outputCostPerMillionTokens: 0.30, contextWindow: 1000000, qualityTier: 'medium', speedTier: 'fast', defaultUseCase: 'simple', enabled: true },
  { provider: 'local', model: 'local-llama', inputCostPerMillionTokens: 0, outputCostPerMillionTokens: 0, contextWindow: 8192, qualityTier: 'medium', speedTier: 'medium', defaultUseCase: 'local', enabled: true },
  { provider: 'unknown', model: 'unknown', inputCostPerMillionTokens: 0, outputCostPerMillionTokens: 0, contextWindow: 4096, qualityTier: 'low', speedTier: 'slow', defaultUseCase: 'fallback', enabled: true }
];

let registry = [...DEFAULT_MODELS];

function getModelEntry(provider, model) {
  return registry.find(m => m.provider === provider && m.model === model) || null;
}

function getModelCost(provider, model) {
  const entry = getModelEntry(provider, model);
  if (!entry) return { inputCostPerMillionTokens: 0, outputCostPerMillionTokens: 0, known: false };
  return {
    inputCostPerMillionTokens: entry.inputCostPerMillionTokens,
    outputCostPerMillionTokens: entry.outputCostPerMillionTokens,
    known: true
  };
}

function getEnabledModels() {
  return registry.filter(m => m.enabled);
}

function getAllModels() {
  return [...registry];
}

function addModelEntry(entry) {
  const existing = getModelEntry(entry.provider, entry.model);
  if (existing) {
    Object.assign(existing, entry);
    return existing;
  }
  const newEntry = {
    provider: entry.provider || 'unknown',
    model: entry.model || 'unknown',
    inputCostPerMillionTokens: typeof entry.inputCostPerMillionTokens === 'number' ? entry.inputCostPerMillionTokens : 0,
    outputCostPerMillionTokens: typeof entry.outputCostPerMillionTokens === 'number' ? entry.outputCostPerMillionTokens : 0,
    contextWindow: entry.contextWindow || 4096,
    qualityTier: entry.qualityTier || 'low',
    speedTier: entry.speedTier || 'slow',
    defaultUseCase: entry.defaultUseCase || 'fallback',
    enabled: entry.enabled !== false
  };
  registry.push(newEntry);
  return newEntry;
}

function updateModelEntry(provider, model, updates) {
  const entry = getModelEntry(provider, model);
  if (!entry) return null;
  Object.assign(entry, updates);
  return entry;
}

function removeModelEntry(provider, model) {
  const idx = registry.findIndex(m => m.provider === provider && m.model === model);
  if (idx === -1) return false;
  registry.splice(idx, 1);
  return true;
}

function resetRegistry() {
  registry = [...DEFAULT_MODELS];
}

function findCheapestModel(minQuality, useCase) {
  const candidates = registry.filter(m => {
    if (!m.enabled) return false;
    const tierOrder = { low: 0, medium: 1, high: 2 };
    if (tierOrder[m.qualityTier] < tierOrder[minQuality || 'low']) return false;
    if (useCase && m.defaultUseCase !== useCase && useCase !== 'any') return false;
    return true;
  });
  if (candidates.length === 0) return registry.find(m => m.enabled) || null;
  candidates.sort((a, b) => (a.inputCostPerMillionTokens + a.outputCostPerMillionTokens) - (b.inputCostPerMillionTokens + b.outputCostPerMillionTokens));
  return candidates[0];
}

function findBestModelForTask(task, preference = 'balanced') {
  const useCaseMap = {
    simple: 'simple',
    chat: 'simple',
    general: 'general',
    complex: 'complex',
    reasoning: 'reasoning',
    coding: 'reasoning',
    evaluation: 'general',
    local: 'local',
    fallback: 'fallback'
  };
  const useCase = useCaseMap[task] || 'general';
  const qualityMap = { economy: 'low', balanced: 'medium', quality: 'high', local_first: 'medium' };
  const minQuality = qualityMap[preference] || 'medium';
  return findCheapestModel(minQuality, useCase);
}

module.exports = {
  getModelEntry,
  getModelCost,
  getEnabledModels,
  getAllModels,
  addModelEntry,
  updateModelEntry,
  removeModelEntry,
  resetRegistry,
  findCheapestModel,
  findBestModelForTask,
  DEFAULT_MODELS
};

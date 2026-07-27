'use strict';

const utils = require('./model-router-utils');
const store = require('./model-router-store');

async function registerModelProvider(input, services = {}) {
  const entry = {
    id: input.id || utils.createId('prov'),
    name: utils.sanitizeText(input.name, 100),
    type: input.type || 'disabled',
    baseUrlEnv: input.baseUrlEnv || '',
    apiKeyEnv: input.apiKeyEnv || '',
    enabledEnv: input.enabledEnv || '',
    defaultModelEnv: input.defaultModelEnv || '',
    supportsVision: !!input.supportsVision,
    supportsTools: !!input.supportsTools,
    supportsJson: !!input.supportsJson,
    supportsLongContext: !!input.supportsLongContext,
    supportsStreaming: !!input.supportsStreaming,
    privacyLevel: input.privacyLevel || 'medium',
    costTier: input.costTier || 'medium',
    createdAt: new Date().toISOString()
  };
  const s = await store.loadModelStore(services);
  const idx = s.providers.findIndex(p => p.name === entry.name || p.id === entry.id);
  if (idx >= 0) s.providers[idx] = { ...s.providers[idx], ...entry, updatedAt: new Date().toISOString() };
  else s.providers.push(entry);
  await store.saveModelStore(s, services);
  return entry;
}

async function getDefaultProviders(services = {}) {
  const s = await store.loadModelStore(services);
  if (s.providers.length) return s.providers;
  const defaults = [
    { id: 'local_openai_compatible', name: 'Local OpenAI Compatible', type: 'local', baseUrlEnv: 'LOCAL_AI_BASE_URL', apiKeyEnv: 'LOCAL_AI_API_KEY', enabledEnv: 'LOCAL_AI_ENABLED', defaultModelEnv: 'LOCAL_AI_DEFAULT_MODEL', supportsVision: true, supportsTools: false, supportsJson: true, supportsLongContext: true, supportsStreaming: true, privacyLevel: 'high', costTier: 'low' },
    { id: 'local_ollama', name: 'Local Ollama', type: 'local', baseUrlEnv: 'OLLAMA_BASE_URL', apiKeyEnv: '', enabledEnv: 'OLLAMA_ENABLED', defaultModelEnv: 'OLLAMA_DEFAULT_MODEL', supportsVision: true, supportsTools: false, supportsJson: true, supportsLongContext: true, supportsStreaming: true, privacyLevel: 'high', costTier: 'low' },
    { id: 'mistral', name: 'Mistral AI', type: 'cloud', baseUrlEnv: 'MISTRAL_BASE_URL', apiKeyEnv: 'MISTRAL_API_KEY', enabledEnv: 'AI_PROVIDER', defaultModelEnv: 'MISTRAL_DEFAULT_MODEL', supportsVision: true, supportsTools: true, supportsJson: true, supportsLongContext: true, supportsStreaming: true, privacyLevel: 'medium', costTier: 'medium' },
    { id: 'groq', name: 'Groq', type: 'cloud', baseUrlEnv: 'GROQ_BASE_URL', apiKeyEnv: 'GROQ_API_KEY', enabledEnv: 'AI_PROVIDER', defaultModelEnv: 'GROQ_DEFAULT_MODEL', supportsVision: false, supportsTools: true, supportsJson: true, supportsLongContext: false, supportsStreaming: true, privacyLevel: 'low', costTier: 'low' },
    { id: 'openai', name: 'OpenAI', type: 'cloud', baseUrlEnv: 'OPENAI_BASE_URL', apiKeyEnv: 'OPENAI_API_KEY', enabledEnv: 'AI_PROVIDER', defaultModelEnv: 'OPENAI_DEFAULT_MODEL', supportsVision: true, supportsTools: true, supportsJson: true, supportsLongContext: true, supportsStreaming: true, privacyLevel: 'low', costTier: 'high' },
    { id: 'gemini', name: 'Google Gemini', type: 'cloud', baseUrlEnv: 'GEMINI_BASE_URL', apiKeyEnv: 'GEMINI_API_KEY', enabledEnv: 'AI_PROVIDER', defaultModelEnv: 'GEMINI_DEFAULT_MODEL', supportsVision: true, supportsTools: true, supportsJson: true, supportsLongContext: true, supportsStreaming: true, privacyLevel: 'low', costTier: 'medium' },
    { id: 'fallback_stub', name: 'Fallback Stub', type: 'fallback', baseUrlEnv: '', apiKeyEnv: '', enabledEnv: '', defaultModelEnv: '', supportsVision: false, supportsTools: false, supportsJson: false, supportsLongContext: false, supportsStreaming: false, privacyLevel: 'high', costTier: 'low' }
  ];
  s.providers = defaults;
  await store.saveModelStore(s, services);
  return defaults;
}

async function listProviders(filters = {}, services = {}) {
  const s = await store.loadModelStore(services);
  let list = s.providers.length ? s.providers : await getDefaultProviders(services);
  if (filters.type) list = list.filter(p => p.type === filters.type);
  return list;
}

module.exports = { registerModelProvider, getDefaultProviders, listProviders };

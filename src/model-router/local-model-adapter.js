'use strict';

const utils = require('./model-router-utils');

async function checkLocalModelAvailability(services = {}) {
  const enabled = utils.getEnv(services, 'LOCAL_AI_ENABLED', '').toLowerCase();
  if (!enabled || enabled === 'false' || enabled === '0') return { available: false, reason: 'LOCAL_AI_ENABLED not set or disabled.' };
  const baseUrl = utils.getEnv(services, 'LOCAL_AI_BASE_URL', '');
  if (!baseUrl) return { available: false, reason: 'LOCAL_AI_BASE_URL not set.' };
  return { available: true, baseUrl, provider: utils.getEnv(services, 'LOCAL_AI_PROVIDER', 'openai_compatible') };
}

async function callLocalOpenAICompatible(payload = {}, services = {}) {
  const availability = await checkLocalModelAvailability(services);
  if (!availability.available) return { error: 'Local AI not available.', available: false };
  try {
    const baseUrl = availability.baseUrl;
    const model = payload.model || utils.getEnv(services, 'LOCAL_AI_DEFAULT_MODEL', 'local-model');
    const timeout = Number(utils.getEnv(services, 'LOCAL_AI_TIMEOUT_MS', '30000'));
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${utils.getEnv(services, 'LOCAL_AI_API_KEY', '')}` },
      body: JSON.stringify({ model, messages: payload.messages || [], max_tokens: Number(utils.getEnv(services, 'LOCAL_AI_MAX_TOKENS', '2048')), temperature: payload.temperature || 0.3 }),
      signal: controller.signal
    });
    clearTimeout(timer);
    if (!response.ok) return { error: `Local AI returned ${response.status}`, available: false };
    const data = await response.json();
    return normalizeLocalModelResponse(data, services);
  } catch (e) {
    return { error: `Local AI call failed: ${e.message || e}`, available: false };
  }
}

async function callLocalOllamaCompatible(payload = {}, services = {}) {
  const availability = await checkLocalModelAvailability(services);
  if (!availability.available) return { error: 'Ollama not available.', available: false };
  try {
    const baseUrl = availability.baseUrl;
    const model = payload.model || utils.getEnv(services, 'LOCAL_AI_DEFAULT_MODEL', 'llama3');
    const timeout = Number(utils.getEnv(services, 'LOCAL_AI_TIMEOUT_MS', '30000'));
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages: payload.messages || [], stream: false, options: { temperature: payload.temperature || 0.3, num_predict: Number(utils.getEnv(services, 'LOCAL_AI_MAX_TOKENS', '2048')) } }),
      signal: controller.signal
    });
    clearTimeout(timer);
    if (!response.ok) return { error: `Ollama returned ${response.status}`, available: false };
    const data = await response.json();
    return { content: data.message?.content || data.response || '', model: data.model || model, available: true };
  } catch (e) {
    return { error: `Ollama call failed: ${e.message || e}`, available: false };
  }
}

function buildLocalModelRequest(input = {}, route = {}, services = {}) {
  return { model: route.model || 'default', messages: input.messages || [{ role: 'user', content: String(input.text || '') }], temperature: input.temperature || 0.3 };
}

function normalizeLocalModelResponse(response = {}, services = {}) {
  const choice = response.choices?.[0];
  return { content: choice?.message?.content || response.content || '', model: response.model || 'local', available: true, usage: response.usage || {} };
}

module.exports = { checkLocalModelAvailability, callLocalOpenAICompatible, callLocalOllamaCompatible, buildLocalModelRequest, normalizeLocalModelResponse };

'use strict';

const utils = require('./model-router-utils');
const privacyPolicy = require('./privacy-aware-routing-policy');

async function checkCloudProviderAvailability(provider = {}, services = {}) {
  const name = provider.name || '';
  const apiKey = utils.getEnv(services, provider.apiKeyEnv || '', '');
  if (!apiKey) return { available: false, reason: `API key for ${name} not configured.` };
  const enabled = utils.getEnv(services, provider.enabledEnv || '', '');
  if (enabled && enabled.toLowerCase() !== provider.id && enabled !== '*') return { available: false, reason: `${name} not selected as active provider.` };
  return { available: true, provider: name };
}

function buildCloudModelRequest(input = {}, route = {}, services = {}) {
  const redacted = privacyPolicy.redactModelInputForCloud(String(input.text || ''), {}, services);
  return { model: route.model || 'default', messages: input.messages || [{ role: 'user', content: redacted }], temperature: input.temperature || 0.3 };
}

function normalizeCloudModelResponse(response = {}, services = {}) {
  const content = response.choices?.[0]?.message?.content || response.candidates?.[0]?.content?.parts?.[0]?.text || response.content || '';
  return { content, model: response.model || 'cloud', usage: response.usage || {} };
}

async function fallbackCloudProvider(route = {}, services = {}) {
  const providers = []; // would come from provider registry
  for (const p of providers) {
    if (p.id === route.providerId) continue;
    const avail = await checkCloudProviderAvailability(p, services);
    if (avail.available) return { ...route, providerId: p.id, provider: p.name, fallback: true };
  }
  return null;
}

module.exports = { checkCloudProviderAvailability, buildCloudModelRequest, normalizeCloudModelResponse, fallbackCloudProvider };

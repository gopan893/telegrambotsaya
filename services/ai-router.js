'use strict';

const KNOWN_PROVIDERS = ['groq', 'mistral'];

function normalizeProvider(provider) {
  const value = String(provider || '').trim().toLowerCase();
  return KNOWN_PROVIDERS.includes(value) ? value : 'groq';
}

function chooseProviderOrder(options = {}) {
  const preferred = normalizeProvider(options.preferred);
  const available = options.available || {};
  const preferredOrder = preferred === 'mistral'
    ? ['mistral', 'groq']
    : ['groq', 'mistral'];

  const configured = KNOWN_PROVIDERS.filter((provider) => Boolean(available[provider]));
  if (!configured.length) return preferredOrder;

  return [
    ...preferredOrder.filter((provider) => configured.includes(provider)),
    ...configured.filter((provider) => !preferredOrder.includes(provider))
  ];
}

function shouldUseSearchFallback(options = {}) {
  return Boolean(options.allowSearch && options.hasSearchKey);
}

module.exports = {
  chooseProviderOrder,
  shouldUseSearchFallback
};

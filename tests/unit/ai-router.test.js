'use strict';

const { chooseProviderOrder } = require('../../services/ai-router');

describe('ai-router provider order', () => {
  test('defaults to Groq before stale Gacor tunnel', () => {
    expect(chooseProviderOrder({
      preferred: 'gacor',
      available: { gacor: true, groq: true, mistral: true }
    })).toEqual(['gacor', 'groq', 'mistral']);

    expect(chooseProviderOrder({
      preferred: 'groq',
      available: { gacor: true, groq: true, mistral: true }
    })).toEqual(['groq', 'mistral', 'gacor']);
  });

  test('uses configured fallback when preferred provider is unavailable', () => {
    expect(chooseProviderOrder({
      preferred: 'groq',
      available: { gacor: true, mistral: true }
    })).toEqual(['mistral', 'gacor']);
  });
});

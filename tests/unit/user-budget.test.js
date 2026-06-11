'use strict';

const { checkUserDailyBudget } = require('../../src/cost/budget-guard');
const store = require('../../src/cost/cost-usage-store');

describe('User Daily Budget', () => {
  beforeEach(() => {
    store.clearEvents();
  });

  test('allows requests within daily limit', () => {
    const result = checkUserDailyBudget('test-user-1', 1000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBeGreaterThan(0);
    expect(result.resetAt).toBeGreaterThan(Date.now());
  });

  test('blocks requests exceeding daily limit', () => {
    store.recordModelUsage({
      userId: 'test-user-high',
      model: 'gpt-4o-mini',
      provider: 'openai',
      inputTokens: 60000,
      outputTokens: 0,
      estimatedCost: 0.01,
      source: 'natural_chat'
    });
    const result = checkUserDailyBudget('test-user-high', 1000);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  test('blocks when estimated tokens would exceed limit', () => {
    store.recordModelUsage({
      userId: 'test-user-mid',
      model: 'gpt-4o-mini',
      provider: 'openai',
      inputTokens: 48000,
      outputTokens: 0,
      estimatedCost: 0.01,
      source: 'natural_chat'
    });
    const result = checkUserDailyBudget('test-user-mid', 3000);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(2000);
  });

  test('allows when estimated tokens fit within remaining budget', () => {
    store.recordModelUsage({
      userId: 'test-user-low',
      model: 'gpt-4o-mini',
      provider: 'openai',
      inputTokens: 10000,
      outputTokens: 0,
      estimatedCost: 0.01,
      source: 'natural_chat'
    });
    const result = checkUserDailyBudget('test-user-low', 5000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(40000);
  });

  test('allows with no prior usage', () => {
    const result = checkUserDailyBudget('new-user', 50000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(50000);
  });

  test('resetAt is midnight of next day', () => {
    const result = checkUserDailyBudget('reset-test', 100);
    const resetDate = new Date(result.resetAt);
    expect(resetDate.getHours()).toBe(0);
    expect(resetDate.getMinutes()).toBe(0);
    expect(resetDate.getSeconds()).toBe(0);
  });
});

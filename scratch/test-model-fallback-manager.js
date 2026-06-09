'use strict';

const fallback = require('../src/model-router/model-fallback-manager');

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) pass++; else { fail++; console.error(`FAIL: ${msg}`); } }

async function run() {
  const svc = { env: {} };

  // Create fallback chain (with no providers configured, should still return fallback stub)
  const chain = await fallback.createModelFallbackChain({ class: 'simple_chat' }, { economyMode: true }, svc);
  assert(chain.length >= 1, 'createModelFallbackChain returns at least 1 fallback');
  const last = chain[chain.length - 1];
  assert(last.type === 'fallback', 'last fallback is fallback type');

  // Fallback on timeout
  const timeout = await fallback.fallbackOnTimeout({ providerId: 'openai' }, svc);
  assert(timeout.fallbackReason === 'timeout', 'fallbackOnTimeout reason');

  // Fallback on unavailable
  const unavail = await fallback.fallbackOnProviderUnavailable({ providerId: 'mistral' }, svc);
  assert(unavail.fallbackReason === 'provider_unavailable', 'fallbackOnProviderUnavailable');

  // Fallback on budget
  const budget = await fallback.fallbackOnBudgetExceeded({ providerId: 'openai' }, svc);
  assert(budget.fallbackReason === 'budget_exceeded', 'fallbackOnBudgetExceeded');

  // Fallback on privacy
  const privacy = await fallback.fallbackOnPrivacyBlocked({ providerId: 'cloud' }, svc);
  assert(privacy.fallbackReason === 'privacy_blocked', 'fallbackOnPrivacyBlocked');

  console.log(`Result: ${pass} PASS, ${fail} FAIL`);
  process.exit(fail ? 1 : 0);
}
run().catch(e => { console.error('Test error:', e); process.exit(1); });

'use strict';

const modelRouter = require('../src/model-router');

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) pass++; else { fail++; console.error(`FAIL: ${msg}`); } }

async function run() {
  const svc = {};

  // Get default providers
  const providers = await modelRouter.modelProviderRegistry.getDefaultProviders(svc);
  assert(providers.length >= 5, 'getDefaultProviders returns at least 5 providers');

  // Check specific providers
  const openai = providers.find(p => p.id === 'openai');
  assert(openai, 'has openai provider');
  assert(openai.type === 'cloud', 'openai is cloud');
  assert(openai.costTier === 'high', 'openai high cost');

  const local = providers.find(p => p.id === 'local_openai_compatible');
  assert(local, 'has local provider');
  assert(local.type === 'local', 'local is local type');
  assert(local.privacyLevel === 'high', 'local high privacy');

  // Register custom provider
  const custom = await modelRouter.modelProviderRegistry.registerModelProvider({ name: 'Custom', type: 'cloud' }, svc);
  assert(custom && custom.name === 'Custom', 'registerModelProvider');

  // List with filter
  const cloud = await modelRouter.modelProviderRegistry.listProviders({ type: 'cloud' }, svc);
  assert(cloud.length >= 1, 'listProviders filter cloud');

  console.log(`Result: ${pass} PASS, ${fail} FAIL`);
  process.exit(fail ? 1 : 0);
}
run().catch(e => { console.error('Test error:', e); process.exit(1); });

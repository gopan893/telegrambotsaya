'use strict';

const modelRouter = require('../src/model-router');

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) pass++; else { fail++; console.error(`FAIL: ${msg}`); } }

async function run() {
  const svc = {};

  // Get default capabilities
  const caps = await modelRouter.modelCapabilityRegistry.getDefaultCapabilities(svc);
  assert(caps.length >= 4, 'getDefaultCapabilities returns at least 4 capabilities');

  const chat = caps.find(c => c.capability === 'chat');
  assert(chat, 'has chat capability');

  // Register capability
  const custom = await modelRouter.modelCapabilityRegistry.registerModelCapability({ providerId: 'test', modelName: 'test-model', capability: 'embedding' }, svc);
  assert(custom && custom.id, 'registerModelCapability');

  // List with filters
  const chatCaps = await modelRouter.modelCapabilityRegistry.listCapabilities({ capability: 'chat' }, svc);
  assert(chatCaps.length >= 1, 'listCapabilities filter capability');

  const providerCaps = await modelRouter.modelCapabilityRegistry.listCapabilities({ providerId: 'local_openai_compatible' }, svc);
  assert(providerCaps.length >= 1, 'listCapabilities filter providerId');

  console.log(`Result: ${pass} PASS, ${fail} FAIL`);
  process.exit(fail ? 1 : 0);
}
run().catch(e => { console.error('Test error:', e); process.exit(1); });

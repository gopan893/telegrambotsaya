'use strict';

const cloud = require('../src/model-router/cloud-model-adapter');
const privacy = require('../src/model-router/privacy-aware-routing-policy');

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) pass++; else { fail++; console.error(`FAIL: ${msg}`); } }

async function run() {
  // Check cloud availability (should fail gracefully without API key)
  const avail = await cloud.checkCloudProviderAvailability({ name: 'Mistral', apiKeyEnv: 'MISTRAL_API_KEY' }, { env: {} });
  assert(avail.available === false, 'checkCloudProviderAvailability fails without key');

  // buildCloudModelRequest should redact secrets
  const req = cloud.buildCloudModelRequest({ text: 'my key is sk-abc123' }, { providerId: 'mistral' }, {});
  assert(!req.messages[0].content.includes('sk-abc123'), 'buildCloudModelRequest redacts secrets');

  // normalizeCloudModelResponse
  const norm = cloud.normalizeCloudModelResponse({ choices: [{ message: { content: 'response' } }], model: 'mistral' });
  assert(norm.content === 'response', 'normalizeCloudModelResponse extracts content');
  assert(norm.model === 'mistral', 'normalize preserves model name');

  // fallbackCloudProvider
  const fallback = await cloud.fallbackCloudProvider({ providerId: 'mistral' }, {});
  assert(fallback === null || typeof fallback === 'object', 'fallbackCloudProvider returns null or object');

  console.log(`Result: ${pass} PASS, ${fail} FAIL`);
  process.exit(fail ? 1 : 0);
}
run().catch(e => { console.error('Test error:', e); process.exit(1); });

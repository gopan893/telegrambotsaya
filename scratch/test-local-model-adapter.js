'use strict';

const local = require('../src/model-router/local-model-adapter');

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) pass++; else { fail++; console.error(`FAIL: ${msg}`); } }

async function run() {
  // Check availability (should fail gracefully)
  const avail = await local.checkLocalModelAvailability({ env: {} });
  assert(avail.available === false, 'checkLocalModelAvailability returns false without config');

  // callLocalOpenAICompatible should fail softly
  const result = await local.callLocalOpenAICompatible({ messages: [] }, { env: {} });
  assert(result.available === false, 'callLocalOpenAICompatible fails softly');
  assert(result.error, 'returns error message');

  // callLocalOllamaCompatible should fail softly
  const ollama = await local.callLocalOllamaCompatible({ messages: [] }, { env: {} });
  assert(ollama.available === false, 'callLocalOllamaCompatible fails softly');

  // buildLocalModelRequest
  const req = local.buildLocalModelRequest({ text: 'hello', temperature: 0.5 }, {});
  assert(req.messages[0].content === 'hello', 'buildLocalModelRequest builds payload');

  // normalizeLocalModelResponse
  const norm = local.normalizeLocalModelResponse({ choices: [{ message: { content: 'hi' } }], model: 'test' });
  assert(norm.content === 'hi', 'normalizeLocalModelResponse extracts content');

  console.log(`Result: ${pass} PASS, ${fail} FAIL`);
  process.exit(fail ? 1 : 0);
}
run().catch(e => { console.error('Test error:', e); process.exit(1); });

'use strict';

const classifier = require('../src/research/research-intent-classifier');

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) pass++; else { fail++; console.error(`FAIL: ${msg}`); } }

const tests = [
  { input: 'riset Gemini Vision API', expectedCat: 'api_research' },
  { input: 'bandingkan Groq vs Mistral', expectedCat: 'ai_model_research' },
  { input: 'cari cara setup Ollama untuk model lokal', expectedCat: 'ai_model_research' },
  { input: 'cek docs project saya apakah lengkap', expectedCat: 'documentation_review' },
  { input: 'buat rencana RAG', expectedCat: 'product_decision' },
  { input: 'cara deploy ke Render', expectedCat: 'deployment_research' },
  { input: 'bandingkan harga OpenAI vs Groq', expectedCat: 'cost_comparison' },
  { input: 'error saat running bot', expectedCat: 'troubleshooting' },
];

for (const t of tests) {
  const result = classifier.classifyResearchIntent(t.input);
  assert(result.category === t.expectedCat, `classifyResearchIntent('${t.input}') -> ${result.category} (expected ${t.expectedCat})`);
}

// sensitivity
assert(classifier.detectResearchSensitivity('secret token') === 'high', 'detectResearchSensitivity high for token');
assert(classifier.detectResearchSensitivity('mood energy private') === 'high', 'detectResearchSensitivity high for private');
assert(classifier.detectResearchSensitivity('public data') === 'low', 'detectResearchSensitivity low for public');

// external sources
assert(classifier.detectResearchRequiresExternalSources('latest update') === true, 'detectResearchRequiresExternalSources true');
assert(classifier.detectResearchRequiresExternalSources('dokumentasi lokal') === false, 'detectResearchRequiresExternalSources false');

// implementation plan
assert(classifier.detectResearchNeedsImplementationPlan('buat fitur baru') === true, 'detectResearchNeedsImplementationPlan true');
assert(classifier.detectResearchNeedsImplementationPlan('apa itu AI') === false, 'detectResearchNeedsImplementationPlan false');

console.log(`Result: ${pass} PASS, ${fail} FAIL`);
process.exit(fail ? 1 : 0);

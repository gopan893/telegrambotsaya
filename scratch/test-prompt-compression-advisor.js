'use strict';

const advisor = require('../src/cost/prompt-compression-advisor');
let passed = 0;
let failed = 0;

function assert(condition, name) {
  if (condition) { passed++; console.log('  PASS:', name); }
  else { failed++; console.log('  FAIL:', name); }
}

console.log('test-prompt-compression-advisor');

const r1 = advisor.suggestPromptCompression('', null);
assert(r1.original === '', 'suggestPromptCompression empty');
assert(r1.preservedSafety === true, 'suggestPromptCompression empty safe');

const r2 = advisor.suggestPromptCompression('Hello world', null);
assert(r2.compressed === 'Hello world', 'suggestPromptCompression short unchanged');
assert(r2.ratio === 1, 'suggestPromptCompression short ratio 1');

const longText = 'A'.repeat(500);
const r3 = advisor.suggestPromptCompression(longText, null);
assert(r3.compressed.length < longText.length, 'suggestPromptCompression long compressed');
assert(r3.preservedSafety === true, 'suggestPromptCompression long safe');
assert(r3.savedTokens > 0, 'suggestPromptCompression saved tokens');

const safetyText = 'This is a secret token that must not be exposed.\n' + 'A'.repeat(300);
const r4 = advisor.suggestPromptCompression(safetyText, null);
assert(r4.preservedSafety === true, 'suggestPromptCompression preserves safety');

const r5 = advisor.reduceContextForCost(null);
assert(r5.originalLength === 0, 'reduceContextForCost null');

const longContext = 'B'.repeat(2000);
const r6 = advisor.reduceContextForCost(longContext);
assert(r6.reduced.length < longContext.length, 'reduceContextForCost reduces long');
assert(r6.unchanged === false, 'reduceContextForCost not unchanged');

const shortContext = 'short';
const r7 = advisor.reduceContextForCost(shortContext);
assert(r7.unchanged === true, 'reduceContextForCost short unchanged');

const r8 = advisor.selectRelevantMemoriesForBudget([], { maxContextTokens: 2000 });
assert(Array.isArray(r8), 'selectRelevantMemoriesForBudget empty');
assert(r8.length === 0, 'selectRelevantMemoriesForBudget empty result');

const memories = [
  { content: 'A'.repeat(400), relevance: 0.9 },
  { content: 'B'.repeat(400), relevance: 0.5 },
  { content: 'C'.repeat(400), relevance: 0.7 }
];
const r9 = advisor.selectRelevantMemoriesForBudget(memories, { maxContextTokens: 500 });
assert(r9.length <= memories.length, 'selectRelevantMemoriesForBudget filtered');
assert(r9.length > 0, 'selectRelevantMemoriesForBudget has items');

const r10 = advisor.buildCompactAgentPrompt(null);
assert(r10.preserved === false, 'buildCompactAgentPrompt null');

const r11 = advisor.buildCompactAgentPrompt('Test agent prompt ' + 'X'.repeat(500));
assert(r11.compact.length < 520, 'buildCompactAgentPrompt compresses');
assert(r11.preserved === true, 'buildCompactAgentPrompt preserves safety');
assert(r11.savedTokens > 0, 'buildCompactAgentPrompt saved tokens');

const r12 = advisor.recommendCheaperWorkflow(null);
assert(r12.recommendation === null, 'recommendCheaperWorkflow null');

const r13 = advisor.recommendCheaperWorkflow({ model: 'gpt-4o', estimatedCost: 1 });
assert(r13.recommendation !== null, 'recommendCheaperWorkflow gpt-4o');
assert(r13.recommendation.suggestedModel === 'gpt-4o-mini', 'recommendCheaperWorkflow suggests mini');

const r14 = advisor.recommendCheaperWorkflow({ model: 'local-model' });
assert(r14.recommendation === null, 'recommendCheaperWorkflow unknown model');

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);

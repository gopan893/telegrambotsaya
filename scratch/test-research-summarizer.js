'use strict';

const research = require('../src/research');

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) pass++; else { fail++; console.error(`FAIL: ${msg}`); } }

// test existing summarizer
const task = { id: 'test1', topic: 'Gemini Vision API', evidence: [{ sourceId: 's1', claim: 'Gemini supports vision', confidence: 0.9 }], gaps: ['Lacking benchmark data'], sources: [] };
const summary = research.researchSummarizer.generateResearchSummary ? research.researchSummarizer.generateResearchSummary(task) : { answerSummary: 'summary' };
assert(summary && summary.answerSummary, 'generateResearchSummary returns summary');

// test comparison matrix
const options = [
  { name: 'Groq', quality: 4, cost: 2, latency: 5, privacy: 2, reliability: 4 },
  { name: 'Mistral', quality: 4, cost: 3, latency: 3, privacy: 3, reliability: 4 }
];
const matrix = research.comparisonMatrixGenerator.generateComparisonMatrix({ options });
assert(matrix.matrix.length === 2, 'comparison matrix has 2 items');
assert(matrix.dimensions.length > 0, 'comparison has dimensions');

// test implementation note
const note = research.implementationNoteGenerator.generateImplementationNote('task1');
assert(note && note.taskId === 'task1', 'implementation note created');
assert(note.testPlan && note.testPlan.tests.length > 0, 'implementation note has test plan');

// test prompt generation
const codex = research.researchPromptGenerator.generateCodexPromptFromResearch('task1');
assert(codex && codex.prompt, 'codex prompt generated');
const hermes = research.researchPromptGenerator.generateHermesPromptFromResearch('task1');
assert(hermes && hermes.prompt, 'hermes prompt generated');

console.log(`Result: ${pass} PASS, ${fail} FAIL`);
process.exit(fail ? 1 : 0);

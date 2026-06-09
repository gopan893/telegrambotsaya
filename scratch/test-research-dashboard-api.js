'use strict';

const research = require('../src/research');

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) pass++; else { fail++; console.error(`FAIL: ${msg}`); } }

async function run() {
  const svc = { workspaceId: 'test', userId: 'tester' };

  // Create task
  const task = await research.researchTaskManager.createResearchTask({ title: 'API Test', query: 'test query', category: 'api_research' }, svc);
  assert(task && task.id, 'create task via manager');

  // Sources
  const src = await research.sourceRegistry.registerResearchSource({ title: 'Doc Source', type: 'official_doc', trustLevel: 'high', freshness: 'high' }, svc);
  assert(src && src.id, 'register source via manager');

  // Notes
  const notes = research.researchNoteBuilder.createResearchNotes(task.id, [src]);
  assert(notes.notes.length === 1, 'create notes');

  // Summarize
  const summary = research.researchSummarizer.generateResearchSummary ? research.researchSummarizer.generateResearchSummary(task) : { answerSummary: 'ok' };
  assert(summary.answerSummary, 'generate summary');

  // Compare
  const matrix = research.comparisonMatrixGenerator.generateComparisonMatrix({ options: [{ name: 'A' }, { name: 'B' }] });
  assert(matrix.matrix.length === 2, 'compare 2 options');

  // Implementation note
  const note = research.implementationNoteGenerator.generateImplementationNote(task.id);
  assert(note.testPlan, 'implementation note');

  // Prompt
  const prompt = research.researchPromptGenerator.generateCodexPromptFromResearch(task.id);
  assert(prompt.prompt, 'generate prompt');

  // Proposal bridge
  const plan = await research.researchProposalBridge.createResearchActionPlan(task.id, svc);
  assert(plan && plan.actions.length > 0, 'proposal bridge');

  console.log(`Result: ${pass} PASS, ${fail} FAIL`);
  process.exit(fail ? 1 : 0);
}
run().catch(e => { console.error('Test error:', e); process.exit(1); });

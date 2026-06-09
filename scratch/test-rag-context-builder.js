'use strict';

const { ragContextBuilder } = require('../src/rag-kb');

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL:', msg); } }

async function run() {
  const results = [
    { docId: 'a', score: 0.95, content: 'Short text' },
    { docId: 'b', score: 0.80, content: 'Another result here' },
    { docId: 'c', score: 0.60, content: 'Third piece of content for testing' },
    { docId: 'd', score: 0.40, content: 'Fourth document with more words in it' }
  ];

  const ctx = ragContextBuilder.buildContext(results);
  assert(ctx.context.length > 0, 'buildContext returns non-empty context string');
  assert(ctx.sourceCount > 0, 'buildContext sourceCount > 0');
  assert(ctx.totalTokens > 0, 'buildContext totalTokens > 0');
  assert(typeof ctx.truncated === 'boolean', 'buildContext has truncated flag');

  const ctxAll = ragContextBuilder.buildContext(results, { maxTokens: 99999 });
  assert(ctxAll.sourceCount === 4, 'buildContext with large budget includes all sources');
  assert(ctxAll.truncated === false, 'buildContext truncated=false when all fit');

  const ctxOne = ragContextBuilder.buildContext(results, { maxTokens: 5 });
  assert(ctxOne.sourceCount < 4, 'buildContext with tiny budget truncates');
  assert(ctxOne.truncated === true, 'buildContext truncated=true when results exceed budget');

  const ctxNoScores = ragContextBuilder.buildContext(results, { includeScores: false });
  assert(!ctxNoScores.context.includes('Score:'), 'buildContext without scores');

  const structured = ragContextBuilder.buildStructuredContext(results);
  assert(structured.sources.length === 4, 'buildStructuredContext all sources');
  assert(structured.count === 4, 'buildStructuredContext count');
  assert(structured.totalAvailable === 4, 'buildStructuredContext totalAvailable');

  const structuredLimit = ragContextBuilder.buildStructuredContext(results, { maxSources: 2 });
  assert(structuredLimit.sources.length === 2, 'buildStructuredContext respects maxSources');
  assert(structuredLimit.sources[0].id === 'a', 'buildStructuredContext preserves order');
  assert(structuredLimit.sources[0].excerpt, 'buildStructuredContext has excerpt');

  console.log('Result: ' + pass + ' PASS, ' + fail + ' FAIL');
  process.exit(fail ? 1 : 0);
}
run().catch(e => { console.error('Test error:', e); process.exit(1); });

'use strict';

const { ragSourceRanker } = require('../src/rag-kb');

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL:', msg); } }

async function run() {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  const results = [
    { docId: 'a', score: 0.5, metadata: { published: new Date(now - 1 * dayMs).toISOString(), authority: 8 } },
    { docId: 'b', score: 0.5, metadata: { published: new Date(now - 60 * dayMs).toISOString(), authority: 3 } },
    { docId: 'c', score: 0.5, metadata: { published: new Date(now - 120 * dayMs).toISOString(), authority: 1 } }
  ];

  const ranked = ragSourceRanker.rankSources(results, {
    recencyField: 'published',
    recencyWeightDays: 90 * dayMs,
    recencyWeight: 0.2,
    authorityField: 'authority',
    authorityWeight: 0.15
  });
  assert(ranked.length === 3, 'rankSources returns all results');
  assert(ranked[0].docId === 'a', 'rankSources ranks recent doc higher');
  assert(ranked[0].rankScore >= ranked[1].rankScore, 'rankSources is sorted descending');
  assert(typeof ranked[0].rankScore === 'number', 'rankSources has rankScore');

  const noOpts = ragSourceRanker.rankSources(results);
  assert(noOpts.length === 3, 'rankSources works without options');
  assert(noOpts[0].rankScore === 0.5, 'rankSources rankScore = score without options');

  const diverse = [
    { docId: 'd1', source: 'github' },
    { docId: 'd2', source: 'github' },
    { docId: 'd3', source: 'wiki' },
    { docId: 'd4', source: 'manual' }
  ];

  const diversified = ragSourceRanker.diversifyTopK(Array.from(diverse), 3, 'source');
  assert(diversified.length === 3, 'diversifyTopK returns up to topK');
  const sources = diversified.map(d => d.source);
  assert(new Set(sources).size === sources.length, 'diversifyTopK ensures unique sources');

  const diversifiedAll = ragSourceRanker.diversifyTopK(Array.from(diverse), 10, 'source');
  assert(diversifiedAll.length === 3, 'diversifyTopK returns only unique sources');

  const diversifiedFieldMissing = ragSourceRanker.diversifyTopK(
    [{ docId: 'e' }, { docId: 'f' }], 2, 'source'
  );
  assert(diversifiedFieldMissing.length === 2, 'diversifyTopK falls back to docId');

  console.log('Result: ' + pass + ' PASS, ' + fail + ' FAIL');
  process.exit(fail ? 1 : 0);
}
run().catch(e => { console.error('Test error:', e); process.exit(1); });

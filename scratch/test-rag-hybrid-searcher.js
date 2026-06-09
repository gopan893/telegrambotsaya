'use strict';

const { ragVectorIndex, ragHybridSearcher } = require('../src/rag-kb');

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL:', msg); } }

async function run() {
  ragVectorIndex.resetIndex();

  await ragVectorIndex.indexDocument('d1', 'How to install the package');
  await ragVectorIndex.indexDocument('d2', 'Package installation guide');
  await ragVectorIndex.indexDocument('d3', 'Unrelated weather report');

  const documents = [
    { id: 'd1', content: 'How to install the package' },
    { id: 'd2', content: 'Package installation guide' },
    { id: 'd3', content: 'Unrelated weather report' }
  ];

  const hybrid = await ragHybridSearcher.hybridSearch('install package', { documents, topK: 2 });
  assert(Array.isArray(hybrid), 'hybridSearch returns array');
  assert(hybrid.length <= 2, 'hybridSearch respects topK');
  assert(hybrid[0].docId, 'hybrid result has docId');
  assert(typeof hybrid[0].score === 'number', 'hybrid result has numeric score');

  const keyword = await ragHybridSearcher.keywordSearch('install', documents);
  assert(keyword.length > 0, 'keywordSearch returns results');
  assert(keyword[0].score > 0, 'keywordSearch score > 0');
  assert(keyword[0].docId === 'd1' || keyword[0].docId === 'd2', 'keywordSearch finds matching docs');

  const noMatch = await ragHybridSearcher.keywordSearch('zzzzz', documents);
  assert(noMatch.length === 0, 'keywordSearch returns empty for no match');

  const merge = ragHybridSearcher.mergeResults(
    [{ docId: 'd1', score: 0.9, content: 'abc' }],
    [{ docId: 'd2', score: 0.5, content: 'def' }],
    0.7, 0.3
  );
  assert(merge.length === 2, 'mergeResults combines both sets');
  assert(merge.find(r => r.docId === 'd1').vectorScore === 0.9, 'mergeResults preserves vectorScore');
  assert(merge.find(r => r.docId === 'd2').keywordScore === 0.5, 'mergeResults preserves keywordScore');

  const mergedSame = ragHybridSearcher.mergeResults(
    [{ docId: 'd1', score: 0.9, content: 'abc' }],
    [{ docId: 'd1', score: 0.5, content: 'abc' }],
    0.7, 0.3
  );
  assert(mergedSame.length === 1, 'mergeResults deduplicates same docId');
  assert(Math.abs(mergedSame[0].score - (0.9 * 0.7 + 0.5 * 0.3)) < 0.001, 'mergeResults computes weighted score');

  console.log('Result: ' + pass + ' PASS, ' + fail + ' FAIL');
  process.exit(fail ? 1 : 0);
}
run().catch(e => { console.error('Test error:', e); process.exit(1); });

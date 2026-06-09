'use strict';

const { ragVectorIndex } = require('../src/rag-kb');

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL:', msg); } }

async function run() {
  ragVectorIndex.resetIndex();

  const res1 = await ragVectorIndex.indexDocument('doc1', 'The quick brown fox');
  assert(res1 && res1.docId === 'doc1', 'indexDocument returns result with docId');
  assert(res1.vectorLength === 128, 'indexDocument vector is 128 dims');

  const res2 = await ragVectorIndex.indexDocument('doc2', 'Jumped over the lazy dog');
  assert(res2.docId === 'doc2', 'indexDocument second doc');

  const res3 = await ragVectorIndex.indexDocument('doc3', 'The quick brown dog');
  assert(res3, 'indexDocument third doc');

  const batch = await ragVectorIndex.indexBatch([
    { id: 'doc4', content: 'Foxes are quick animals' },
    { id: 'doc5', content: 'Dogs are loyal pets' }
  ]);
  assert(batch.length === 2, 'indexBatch returns 2 results');
  assert(batch[0].docId === 'doc4', 'indexBatch first docId');

  const vec = ragVectorIndex.getVector('doc1');
  assert(vec && vec.docId === 'doc1', 'getVector returns correct entry');
  assert(vec.content === 'The quick brown fox', 'getVector content matches');
  assert(ragVectorIndex.getVector('nonexistent') === null, 'getVector returns null for missing');

  assert(ragVectorIndex.getVectorCount() === 5, 'getVectorCount returns 5');

  const results = await ragVectorIndex.search('quick fox', { topK: 3 });
  assert(results.length === 3, 'search returns top 3 results');
  assert(results[0].score >= results[1].score, 'search results sorted descending');

  const removed = ragVectorIndex.removeVector('doc1');
  assert(removed === true, 'removeVector returns true');
  assert(ragVectorIndex.getVector('doc1') === null, 'removeVector actually removes');
  assert(ragVectorIndex.getVectorCount() === 4, 'getVectorCount after removal');

  const results2 = await ragVectorIndex.search('quick fox');
  assert(results2.length <= 4, 'search after removal returns <=4');

  ragVectorIndex.resetIndex();
  assert(ragVectorIndex.getVectorCount() === 0, 'resetIndex clears all vectors');

  console.log('Result: ' + pass + ' PASS, ' + fail + ' FAIL');
  process.exit(fail ? 1 : 0);
}
run().catch(e => { console.error('Test error:', e); process.exit(1); });

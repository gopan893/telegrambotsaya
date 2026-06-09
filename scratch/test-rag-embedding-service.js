'use strict';

const { ragEmbeddingService } = require('../src/rag-kb');

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL:', msg); } }

async function run() {
  const vec1 = await ragEmbeddingService.embedText('hello world');
  assert(Array.isArray(vec1), 'embedText returns array');
  assert(vec1.length === 128, 'embedText returns 128 dimensions');

  const vec1Cache = await ragEmbeddingService.embedText('hello world');
  assert(vec1Cache.length === 128, 'embedText cached result');

  const vecCustom = await ragEmbeddingService.embedText('test', { dimensions: 64 });
  assert(vecCustom.length === 64, 'embedText respects custom dimensions');

  const batch = await ragEmbeddingService.embedBatch(['foo', 'bar', 'baz']);
  assert(batch.length === 3, 'embedBatch returns 3 vectors');
  assert(batch[0].length === 128, 'embedBatch each vector is 128 dims');
  assert(batch[1].length === 128, 'embedBatch second vector correct');

  const simSame = ragEmbeddingService.cosineSimilarity(vec1, vec1Cache);
  assert(simSame > 0.999 && simSame <= 1, 'cosineSimilarity of same text ~1');

  const vec2 = await ragEmbeddingService.embedText('completely different content here');
  const simDiff = ragEmbeddingService.cosineSimilarity(vec1, vec2);
  assert(simDiff >= -1 && simDiff <= 1, 'cosineSimilarity within [-1, 1]');

  const empty1 = ragEmbeddingService.cosineSimilarity([], []);
  assert(empty1 === 0, 'cosineSimilarity of empty returns 0');

  const mismatch = ragEmbeddingService.cosineSimilarity([1], [1, 2]);
  assert(mismatch === 0, 'cosineSimilarity of mismatched lengths returns 0');

  ragEmbeddingService.clearCache();
  const afterClear = await ragEmbeddingService.embedText('hello world');
  assert(afterClear.length === 128, 'clearCache then embedText still works');

  console.log('Result: ' + pass + ' PASS, ' + fail + ' FAIL');
  process.exit(fail ? 1 : 0);
}
run().catch(e => { console.error('Test error:', e); process.exit(1); });

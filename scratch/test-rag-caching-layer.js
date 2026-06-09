'use strict';

const { ragCachingLayer } = require('../src/rag-kb');

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL:', msg); } }

async function run() {
  ragCachingLayer.clear();

  const initial = ragCachingLayer.get('some query');
  assert(initial === null, 'get returns null for empty cache');

  ragCachingLayer.set('hello world', { result: 'data' });
  const cached = ragCachingLayer.get('hello world');
  assert(cached && cached.result === 'data', 'get returns cached data');
  assert(cached.result === 'data', 'set/get round trip preserves data');

  const upper = ragCachingLayer.get('HELLO WORLD');
  assert(upper && upper.result === 'data', 'get is case-insensitive');

  ragCachingLayer.set('another query', { num: 42 });
  const statsBefore = ragCachingLayer.getStats();
  assert(statsBefore.totalEntries >= 2, 'getStats totalEntries >= 2');

  ragCachingLayer.invalidate('hello world');
  assert(ragCachingLayer.get('hello world') === null, 'invalidate removes entry');

  const statsAfterInvalidate = ragCachingLayer.getStats();
  assert(statsAfterInvalidate.totalEntries === (statsBefore.totalEntries - 1), 'invalidate decreases entry count');

  ragCachingLayer.set('ttl-test', { x: 1 }, -1);
  assert(ragCachingLayer.get('ttl-test') === null, 'get returns null for expired TTL');

  const stats = ragCachingLayer.getStats();
  assert(typeof stats.totalEntries === 'number', 'getStats totalEntries is number');
  assert(typeof stats.activeEntries === 'number', 'getStats activeEntries is number');

  ragCachingLayer.clear();
  const emptyStats = ragCachingLayer.getStats();
  assert(emptyStats.totalEntries === 0, 'clear empties all entries');

  console.log('Result: ' + pass + ' PASS, ' + fail + ' FAIL');
  process.exit(fail ? 1 : 0);
}
run().catch(e => { console.error('Test error:', e); process.exit(1); });

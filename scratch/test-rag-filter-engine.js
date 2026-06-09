'use strict';

const { ragFilterEngine } = require('../src/rag-kb');

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL:', msg); } }

async function run() {
  const docs = [
    { id: 'd1', type: 'text', source: 'manual', tags: ['guide', 'howto'], createdAt: '2025-01-15', score: 0.9 },
    { id: 'd2', type: 'code', source: 'github', tags: ['api', 'reference'], createdAt: '2025-06-01', score: 0.7 },
    { id: 'd3', type: 'text', source: 'wiki', tags: ['guide'], createdAt: '2025-03-10', score: 0.5 }
  ];

  const noFilter = ragFilterEngine.applyFilters(docs, {});
  assert(noFilter.length === 3, 'applyFilters with no filter returns all');

  const byType = ragFilterEngine.applyFilters(docs, { type: 'code' });
  assert(byType.length === 1 && byType[0].id === 'd2', 'applyFilters filters by type');

  const bySource = ragFilterEngine.applyFilters(docs, { source: 'manual' });
  assert(bySource.length === 1 && bySource[0].id === 'd1', 'applyFilters filters by source');

  const byTag = ragFilterEngine.applyFilters(docs, { tag: 'guide' });
  assert(byTag.length === 2, 'applyFilters filters by tag');

  const byAfter = ragFilterEngine.applyFilters(docs, { after: '2025-02-01' });
  assert(byAfter.length === 2, 'applyFilters filters by after date');

  const byBefore = ragFilterEngine.applyFilters(docs, { before: '2025-04-01' });
  assert(byBefore.length === 2, 'applyFilters filters by before date');

  const byScore = ragFilterEngine.applyFilters(docs, { score: 0.6 });
  assert(byScore.length === 2, 'applyFilters filters by score threshold');

  const combined = ragFilterEngine.applyFilters(docs, { type: 'text', tag: 'guide' });
  assert(combined.length === 2, 'applyFilters combines multiple filters (text+guide)');

  const empty = ragFilterEngine.applyFilters(docs, { type: 'nonexistent' });
  assert(empty.length === 0, 'applyFilters returns empty for no match');

  const filters = ragFilterEngine.buildFilterFromQuery('search term @tag:guide @source:manual');
  assert(filters.tag === 'guide', 'buildFilterFromQuery extracts tag');
  assert(filters.source === 'manual', 'buildFilterFromQuery extracts source');

  const noFilters = ragFilterEngine.buildFilterFromQuery('plain query without syntax');
  assert(Object.keys(noFilters).length === 0, 'buildFilterFromQuery returns empty for plain query');

  console.log('Result: ' + pass + ' PASS, ' + fail + ' FAIL');
  process.exit(fail ? 1 : 0);
}
run().catch(e => { console.error('Test error:', e); process.exit(1); });

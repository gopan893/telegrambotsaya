'use strict';

const { ragDocumentStore } = require('../src/rag-kb');

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL:', msg); } }

async function run() {
  ragDocumentStore.resetStore();

  const doc1 = ragDocumentStore.addDocument({ title: 'Test Doc 1', content: 'Hello world', source: 'manual', type: 'text', tags: ['test', 'example'] });
  assert(doc1 && doc1.id && doc1.title === 'Test Doc 1', 'addDocument returns doc with id and title');

  const doc2 = ragDocumentStore.addDocument({ title: 'Code Guide', content: 'function foo()', source: 'github', type: 'code', tags: ['code'] });
  assert(doc2 && doc2.source === 'github', 'addDocument with custom source');

  const doc3 = ragDocumentStore.addDocument({ title: 'README', content: 'Install instructions', source: 'manual', type: 'markdown', tags: ['docs'] });
  assert(doc3, 'addDocument third doc');

  const got = ragDocumentStore.getDocument(doc1.id);
  assert(got && got.title === 'Test Doc 1', 'getDocument returns correct doc');
  assert(ragDocumentStore.getDocument('nonexistent') === null, 'getDocument returns null for missing');

  const updated = ragDocumentStore.updateDocument(doc1.id, { title: 'Updated Doc' });
  assert(updated && updated.title === 'Updated Doc', 'updateDocument updates title');
  assert(typeof updated.updatedAt === 'string', 'updateDocument has updatedAt');

  const noUpdate = ragDocumentStore.updateDocument('nonexistent', {});
  assert(noUpdate === null, 'updateDocument returns null for missing');

  const removed = ragDocumentStore.removeDocument(doc2.id);
  assert(removed === true, 'removeDocument returns true');
  assert(ragDocumentStore.getDocument(doc2.id) === null, 'removeDocument actually removes');

  const allAfterRemove = ragDocumentStore.listDocuments();
  assert(allAfterRemove.length === 2, 'listDocuments returns correct count after remove');

  const filteredType = ragDocumentStore.listDocuments({ type: 'text' });
  assert(filteredType.length === 1 && filteredType[0].type === 'text', 'listDocuments filters by type');

  const filteredTag = ragDocumentStore.listDocuments({ tag: 'docs' });
  assert(filteredTag.length === 1 && filteredTag[0].tags.includes('docs'), 'listDocuments filters by tag');

  const filteredQuery = ragDocumentStore.listDocuments({ query: 'install' });
  assert(filteredQuery.length === 1, 'listDocuments filters by query');

  assert(ragDocumentStore.getDocumentCount() === 2, 'getDocumentCount returns 2');

  ragDocumentStore.resetStore();
  assert(ragDocumentStore.getDocumentCount() === 0, 'resetStore clears all documents');

  console.log('Result: ' + pass + ' PASS, ' + fail + ' FAIL');
  process.exit(fail ? 1 : 0);
}
run().catch(e => { console.error('Test error:', e); process.exit(1); });

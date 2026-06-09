'use strict';

const { ragDocumentChunker } = require('../src/rag-kb');

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL:', msg); } }

async function run() {
  const content = 'First paragraph here.\n\nSecond paragraph there.\n\nThird paragraph everywhere.';

  const paraChunks = ragDocumentChunker.chunkByParagraph(content, 30);
  assert(paraChunks.length === 3, 'chunkByParagraph returns 3 chunks');
  assert(paraChunks[0].index === 0, 'first chunk has index 0');
  assert(paraChunks[0].text === 'First paragraph here.', 'first chunk has correct text');
  assert(paraChunks[0].wordCount === 3, 'first chunk wordCount is 3');
  assert(paraChunks[1].text === 'Second paragraph there.', 'second chunk correct');

  const sentenceText = 'First sentence. Second sentence! Third sentence? Fourth.';
  const sentChunks = ragDocumentChunker.chunkBySentence(sentenceText, 20);
  assert(sentChunks.length === 4, 'chunkBySentence returns 4 chunks');
  assert(sentChunks[0].text.includes('First sentence'), 'first sentence chunk correct');

  const manyWords = Array(100).fill('word').join(' ');
  const tokenChunks = ragDocumentChunker.chunkByTokens(manyWords, 30);
  assert(tokenChunks.length === 4, 'chunkByTokens with maxTokens=30 returns 4 chunks');
  assert(tokenChunks[0].index === 0, 'token chunk has index');
  assert(tokenChunks[0].wordCount <= 30, 'token chunk wordCount within limit');
  assert(tokenChunks[1].index === 1, 'second token chunk index 1');
  assert(tokenChunks[0].text.length > 0, 'token chunk text not empty');

  const smartPara = ragDocumentChunker.smartChunk(content, 'paragraph', 30);
  assert(smartPara.length === 3, 'smartChunk paragraph returns 3');
  assert(smartPara[0].wordCount === 3, 'smartChunk paragraph wordCount');

  const smartSent = ragDocumentChunker.smartChunk(sentenceText, 'sentence', 20);
  assert(smartSent.length === 4, 'smartChunk sentence returns 4');

  const smartToken = ragDocumentChunker.smartChunk(manyWords, 'token', 30);
  assert(smartToken.length === 4, 'smartChunk token returns 4');

  console.log('Result: ' + pass + ' PASS, ' + fail + ' FAIL');
  process.exit(fail ? 1 : 0);
}
run().catch(e => { console.error('Test error:', e); process.exit(1); });

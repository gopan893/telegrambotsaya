'use strict';

const embedding = require('./rag-embedding-service');

const vectors = new Map();

async function indexDocument(docId, content, options = {}) {
  const vector = await embedding.embedText(content, options);
  vectors.set(docId, { docId, vector, content, indexedAt: new Date().toISOString() });
  return { docId, vectorLength: vector.length };
}

async function indexBatch(documents) {
  const results = [];
  for (const doc of documents) {
    const result = await indexDocument(doc.id, doc.content, doc.options);
    results.push(result);
  }
  return results;
}

function removeVector(docId) {
  return vectors.delete(String(docId));
}

function getVector(docId) {
  return vectors.get(String(docId)) || null;
}

function getVectorCount() {
  return vectors.size;
}

async function search(query, options = {}) {
  const queryVec = await embedding.embedText(query, options);
  const results = [];
  for (const [docId, entry] of vectors) {
    const score = embedding.cosineSimilarity(queryVec, entry.vector);
    results.push({ docId, score, content: entry.content.slice(0, 200) });
  }
  results.sort((a, b) => b.score - a.score);
  const topK = options.topK || 10;
  return results.slice(0, topK);
}

function resetIndex() {
  vectors.clear();
}

module.exports = { indexDocument, indexBatch, removeVector, getVector, getVectorCount, search, resetIndex };

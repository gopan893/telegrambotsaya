'use strict';

const embedding = require('./rag-embedding-service');

async function searchBySimilarity(query, documents, options = {}) {
  const queryVec = await embedding.embedText(query, options);
  const threshold = options.threshold || 0.3;
  const topK = options.topK || 10;
  const scored = [];
  for (const doc of documents) {
    const docVec = await embedding.embedText(doc.content || doc.text || '', options);
    const score = embedding.cosineSimilarity(queryVec, docVec);
    if (score >= threshold) {
      scored.push({ docId: doc.id || doc.docId, score, content: (doc.content || doc.text || '').slice(0, 300) });
    }
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}

function rankBySimilarity(query, candidates) {
  return candidates
    .map(c => ({ ...c, similarityScore: c.score || 0 }))
    .sort((a, b) => b.similarityScore - a.similarityScore);
}

module.exports = { searchBySimilarity, rankBySimilarity };

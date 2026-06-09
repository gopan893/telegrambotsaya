'use strict';

const vectorIndex = require('./rag-vector-index');
const similaritySearcher = require('./rag-similarity-searcher');

async function hybridSearch(query, options = {}) {
  const vectorWeight = options.vectorWeight || 0.7;
  const keywordWeight = options.keywordWeight || 0.3;
  const topK = options.topK || 10;
  const vectorResults = await vectorIndex.search(query, { topK: topK * 2 });
  const keywordResults = await keywordSearch(query, options.documents || []);
  const merged = mergeResults(vectorResults, keywordResults, vectorWeight, keywordWeight);
  return merged.slice(0, topK);
}

async function keywordSearch(query, documents) {
  const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  return documents.map(doc => {
    const content = (doc.content || doc.text || '').toLowerCase();
    let score = 0;
    for (const term of terms) {
      const regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      const matches = content.match(regex);
      if (matches) score += matches.length;
    }
    score = score / Math.max(content.split(/\s+/).length, 1);
    return { docId: doc.id || doc.docId, score: Math.min(score, 1), content: (doc.content || doc.text || '').slice(0, 300) };
  }).filter(r => r.score > 0).sort((a, b) => b.score - a.score);
}

function mergeResults(vectorResults, keywordResults, vectorWeight, keywordWeight) {
  const combined = {};
  for (const r of vectorResults) {
    combined[r.docId] = { docId: r.docId, vectorScore: r.score || 0, keywordScore: 0, content: r.content };
  }
  for (const r of keywordResults) {
    if (combined[r.docId]) combined[r.docId].keywordScore = r.score || 0;
    else combined[r.docId] = { docId: r.docId, vectorScore: 0, keywordScore: r.score || 0, content: r.content };
  }
  return Object.values(combined).map(r => ({
    docId: r.docId,
    score: r.vectorScore * vectorWeight + r.keywordScore * keywordWeight,
    vectorScore: r.vectorScore,
    keywordScore: r.keywordScore,
    content: r.content
  })).sort((a, b) => b.score - a.score);
}

module.exports = { hybridSearch, keywordSearch, mergeResults };

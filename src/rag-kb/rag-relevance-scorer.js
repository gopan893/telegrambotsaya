'use strict';

function scoreRelevance(query, content) {
  if (!content) return 0;
  const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  const contentLower = content.toLowerCase();
  const contentWords = contentLower.split(/\s+/);
  let exactMatchCount = 0, partialMatchCount = 0;
  for (const term of queryTerms) {
    if (contentLower.includes(term)) {
      exactMatchCount++;
      const regex = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      partialMatchCount += (contentLower.match(regex) || []).length;
    }
  }
  const exactScore = queryTerms.length > 0 ? exactMatchCount / queryTerms.length : 0;
  const densityScore = contentWords.length > 0 ? Math.min(partialMatchCount / contentWords.length * 10, 1) : 0;
  return exactScore * 0.7 + densityScore * 0.3;
}

function scoreBatch(query, documents) {
  return documents.map(doc => ({
    docId: doc.id || doc.docId,
    score: scoreRelevance(query, doc.content || doc.text || ''),
    content: (doc.content || doc.text || '').slice(0, 200)
  })).sort((a, b) => b.score - a.score);
}

module.exports = { scoreRelevance, scoreBatch };

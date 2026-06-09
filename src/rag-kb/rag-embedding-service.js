'use strict';

const embeddingCache = new Map();

function generateMockEmbedding(text, dimensions = 128) {
  const seed = text.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const vec = [];
  for (let i = 0; i < dimensions; i++) {
    vec.push(Math.sin(seed * (i + 1)) * 0.5 + 0.5);
  }
  return vec;
}

async function embedText(text, options = {}) {
  const dims = options.dimensions || 128;
  const cacheKey = `${text}_${dims}`;
  if (embeddingCache.has(cacheKey)) return embeddingCache.get(cacheKey);
  const vector = generateMockEmbedding(text, dims);
  embeddingCache.set(cacheKey, vector);
  return vector;
}

async function embedBatch(texts, options = {}) {
  const results = [];
  for (const text of texts) {
    const vec = await embedText(text, options);
    results.push(vec);
  }
  return results;
}

function cosineSimilarity(vecA, vecB) {
  if (vecA.length !== vecB.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

function clearCache() {
  embeddingCache.clear();
}

module.exports = { embedText, embedBatch, cosineSimilarity, clearCache };

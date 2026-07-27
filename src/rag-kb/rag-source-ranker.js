'use strict';

function rankSources(results, options = {}) {
  const scored = results.map(r => {
    let score = r.score || 0;
    if (options.recencyField && r.metadata && r.metadata[options.recencyField]) {
      const age = Date.now() - new Date(r.metadata[options.recencyField]).getTime();
      const recencyBonus = Math.max(0, 1 - age / (options.recencyWeightDays || 30 * 24 * 60 * 60 * 1000));
      score += recencyBonus * (options.recencyWeight || 0.1);
    }
    if (options.authorityField && r.metadata && r.metadata[options.authorityField]) {
      score += (r.metadata[options.authorityField] / 10) * (options.authorityWeight || 0.1);
    }
    return { ...r, rankScore: Math.min(score, 1) };
  });
  return scored.sort((a, b) => b.rankScore - a.rankScore);
}

function diversifyTopK(ranked, topK = 5, field = 'source') {
  const seen = new Set();
  const result = [];
  for (const item of ranked) {
    const key = item[field] || item.docId;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
    if (result.length >= topK) break;
  }
  return result;
}

module.exports = { rankSources, diversifyTopK };

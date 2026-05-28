'use strict';

function hasAny(text, words) {
  const lower = String(text || '').toLowerCase();
  return words.some(word => lower.includes(word));
}

function countSignals(text) {
  const lower = String(text || '').toLowerCase();
  let score = 0;
  if (lower.length > 280) score += 1;
  if (/[?？]/.test(lower)) score += 0.5;
  if (hasAny(lower, ['risiko', 'trade-off', 'pro kontra', 'asumsi', 'strategi', 'roadmap'])) score += 1;
  if (hasAny(lower, ['error', 'bug', 'stack trace', 'crash', 'lambat', 'deploy'])) score += 1;
  if (hasAny(lower, ['belajar', 'ajarkan', 'pahami', 'konsep', 'latihan'])) score += 0.8;
  if (hasAny(lower, ['keputusan', 'pilih', 'lebih baik', 'opsi', 'alternatif'])) score += 1;
  return score;
}

function detectComplexity(text = '') {
  const score = countSignals(text);
  if (score >= 2.4) return { level: 'high', score: Math.min(1, score / 4) };
  if (score >= 1.2) return { level: 'medium', score: Math.min(1, score / 4) };
  return { level: 'low', score: Math.min(1, score / 4) };
}

module.exports = {
  detectComplexity,
  hasAny
};

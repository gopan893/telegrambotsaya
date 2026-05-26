'use strict';

const guards = require('./guards');

const RELATIONSHIP_PATTERNS = [
  { relationship: 'depends_on', patterns: ['bergantung pada', 'depends on', 'butuh', 'membutuhkan', 'prasyarat'] },
  { relationship: 'part_of', patterns: ['bagian dari', 'part of', 'komponen', 'module', 'modul'] },
  { relationship: 'caused_by', patterns: ['disebabkan oleh', 'karena', 'caused by', 'akibat'] },
  { relationship: 'supports', patterns: ['mendukung', 'supports', 'memperkuat', 'evidence'] },
  { relationship: 'contradicts', patterns: ['bertentangan', 'contradicts', 'tidak cocok', 'kontradiksi'] },
  { relationship: 'improves', patterns: ['meningkatkan', 'improves', 'optimasi', 'lebih baik'] },
  { relationship: 'blocks', patterns: ['menghambat', 'blocks', 'terhalang', 'risiko'] },
  { relationship: 'belongs_to_project', patterns: ['project', 'proyek', 'repo', 'aplikasi'] },
  { relationship: 'relates_to_goal', patterns: ['goal', 'tujuan', 'target', 'roadmap'] }
];

function extractConcepts(text, max = 8) {
  const clean = guards.sanitizeText(text, 1600);
  const words = guards.tokenize(clean)
    .filter((word) => !['yang', 'dan', 'atau', 'untuk', 'dengan', 'dari', 'this', 'that', 'the', 'and'].includes(word))
    .slice(0, 80);

  const freq = new Map();
  for (const word of words) freq.set(word, (freq.get(word) || 0) + 1);

  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, max)
    .map(([word]) => word);
}

function detectRelationship(text, fromLabel = '', toLabel = '') {
  const lower = guards.sanitizeText(`${text} ${fromLabel} ${toLabel}`, 1600).toLowerCase();
  for (const item of RELATIONSHIP_PATTERNS) {
    if (item.patterns.some((pattern) => lower.includes(pattern))) {
      return item.relationship;
    }
  }
  return 'related_to';
}

function buildRelationships(text, concepts = []) {
  const selected = guards.safeArray(concepts).slice(0, 6);
  const edges = [];
  for (let i = 0; i < selected.length; i += 1) {
    for (let j = i + 1; j < Math.min(selected.length, i + 3); j += 1) {
      edges.push({
        fromLabel: selected[i],
        toLabel: selected[j],
        relationship: detectRelationship(text, selected[i], selected[j]),
        weight: Number((0.45 + guards.textRelevance(text, `${selected[i]} ${selected[j]}`) * 0.4).toFixed(3)),
        confidence: 0.62
      });
    }
  }
  return edges;
}

function classifyConceptType(label, sourceText = '') {
  const text = `${label} ${sourceText}`.toLowerCase();
  if (/(project|proyek|repo|bot|app|sistem|architecture|arsitektur)/i.test(text)) return 'project';
  if (/(goal|tujuan|target|roadmap|milestone)/i.test(text)) return 'goal';
  if (/(error|bug|risk|risiko|crash|gagal)/i.test(text)) return 'risk';
  if (/(file|pdf|dokumen|gambar|spreadsheet|data)/i.test(text)) return 'source';
  return 'concept';
}

function scoreRelationshipStrength(text, fromLabel, toLabel) {
  const relevance = guards.textRelevance(text, `${fromLabel} ${toLabel}`);
  return guards.clamp01(0.45 + relevance * 0.45, 0.5);
}

module.exports = {
  RELATIONSHIP_PATTERNS,
  extractConcepts,
  detectRelationship,
  buildRelationships,
  classifyConceptType,
  scoreRelationshipStrength
};

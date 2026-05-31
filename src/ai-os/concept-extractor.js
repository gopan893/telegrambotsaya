'use strict';

const graphGuards = require('./graph-guards');
const graphUtils = require('./graph-utils');

const TECHNOLOGY_KEYWORDS = [
  'PostgreSQL',
  'Redis',
  'Node.js',
  'Express',
  'Telegram',
  'Render',
  'GitHub',
  'Docker',
  'Next.js',
  'React',
  'Tailwind',
  'Prisma',
  'Supabase',
  'Neon',
  'Groq',
  'Mistral',
  'Tavily',
  'Cloudflare',
  'Termux'
];

const PROJECT_PHRASES = [
  { label: 'AI OS', type: 'project' },
  { label: 'bot AI', type: 'project' },
  { label: 'Telegram AI Bot', type: 'project' },
  { label: 'production bot', type: 'project' },
  { label: 'knowledge graph', type: 'concept' },
  { label: 'conversation intelligence', type: 'concept' },
  { label: 'adaptive mode', type: 'concept' },
  { label: 'persistent memory', type: 'concept' },
  { label: 'memory jangka panjang', type: 'concept' },
  { label: 'storage fallback', type: 'concept' },
  { label: 'Render free tier', type: 'tool' },
  { label: 'global sender', type: 'concept' },
  { label: 'inline keyboard', type: 'concept' }
];

const STOPWORDS = new Set([
  'yang',
  'dan',
  'atau',
  'untuk',
  'dengan',
  'dari',
  'pada',
  'saya',
  'kamu',
  'bot',
  'ini',
  'itu',
  'akan',
  'bisa',
  'agar',
  'dalam',
  'kalau',
  'karena',
  'the',
  'and',
  'for',
  'with',
  'from',
  'this',
  'that'
]);

function normalizeConcept(label) {
  return graphGuards.sanitizeConceptLabel(label);
}

function makeConcept(label, type, text, meta = {}) {
  const clean = normalizeConcept(label);
  if (!clean) return null;
  return {
    label: clean,
    type: type || 'concept',
    importance: scoreConceptImportance(clean, text),
    confidence: meta.confidence || 0.68,
    source: meta.source || 'concept-extractor',
    evidence: meta.evidence || graphUtils.compactText(text, 220),
    tags: meta.tags || []
  };
}

function uniqueConcepts(concepts = [], max = 12) {
  const byKey = new Map();
  for (const concept of concepts) {
    if (!concept?.label) continue;
    const key = graphUtils.normalizeKey(concept.label);
    const prev = byKey.get(key);
    if (!prev || (concept.importance || 0) > (prev.importance || 0)) {
      byKey.set(key, concept);
    }
  }
  return [...byKey.values()]
    .sort((a, b) => (b.importance || 0) - (a.importance || 0))
    .slice(0, max);
}

function extractTechnologies(text = '') {
  const haystack = String(text || '');
  return TECHNOLOGY_KEYWORDS
    .filter(keyword => new RegExp(`(^|[^a-z0-9])${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`, 'i').test(haystack))
    .map(keyword => makeConcept(keyword, 'technology', text, { confidence: 0.86, tags: ['technology'] }))
    .filter(Boolean);
}

function extractProjectConcepts(text = '') {
  const lower = String(text || '').toLowerCase();
  const concepts = PROJECT_PHRASES
    .filter(item => lower.includes(item.label.toLowerCase()))
    .map(item => makeConcept(item.label, item.type, text, { confidence: 0.78, tags: ['project-context'] }))
    .filter(Boolean);

  const phrasePatterns = [
    /\b(persistent\s+memory|memory\s+jangka\s+panjang|long[-\s]?term\s+memory)\b/gi,
    /\b(cache|caching|state\s+cache)\b/gi,
    /\b(storage\s+fallback|json\s+fallback|redis\s+fallback)\b/gi,
    /\b(webhook|express\s+webhook)\b/gi,
    /\b(workflow|goal|insight|memory)\b/gi
  ];

  for (const pattern of phrasePatterns) {
    const matches = String(text || '').match(pattern) || [];
    for (const match of matches) {
      const type = /workflow/.test(match.toLowerCase()) ? 'workflow'
        : /goal/.test(match.toLowerCase()) ? 'goal'
        : /insight/.test(match.toLowerCase()) ? 'insight'
        : 'concept';
      const concept = makeConcept(match, type, text, { confidence: 0.72, tags: ['project-context'] });
      if (concept) concepts.push(concept);
    }
  }

  return uniqueConcepts(concepts, 10);
}

function extractRisks(text = '') {
  const lower = String(text || '').toLowerCase();
  const riskTerms = [
    ['scope creep', /scope\s+creep|terlalu\s+banyak\s+fitur|fitur\s+terlalu\s+banyak/i],
    ['performance risk', /berat|lambat|latency|performance|performa/i],
    ['deployment risk', /deploy|render|crash|startup|webhook\s+gagal/i],
    ['storage risk', /database|storage|postgres|redis|fallback|migration/i],
    ['security risk', /security|keamanan|token|secret|credential/i]
  ];
  return riskTerms
    .filter(([, pattern]) => pattern.test(lower))
    .map(([label]) => makeConcept(label, 'risk', text, { confidence: 0.7, tags: ['risk'] }))
    .filter(Boolean);
}

function extractDecisions(text = '') {
  const lower = String(text || '').toLowerCase();
  if (!/(pilih|memilih|opsi|decision|keputusan|atau|vs|versus)/i.test(lower)) return [];
  const concepts = [];
  const decision = makeConcept(graphUtils.compactText(text, 90), 'decision', text, { confidence: 0.62, tags: ['decision'] });
  if (decision) concepts.push(decision);
  return concepts;
}

function extractPhases(text = '') {
  const matches = String(text || '').match(/\b(?:phase|fase|tahap)\s*\d+[a-z]?\b/gi) || [];
  return matches
    .map(match => makeConcept(match, 'phase', text, { confidence: 0.82, tags: ['phase'] }))
    .filter(Boolean);
}

function extractKeywordConcepts(text = '', options = {}) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  const tokens = graphUtils.tokenize(clean)
    .filter(token => token.length >= 4)
    .filter(token => !STOPWORDS.has(token))
    .filter(token => !/^\d+$/.test(token));

  const freq = new Map();
  for (const token of tokens) freq.set(token, (freq.get(token) || 0) + 1);

  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, options.maxKeywords || 8)
    .map(([token, count]) => makeConcept(token, 'concept', text, {
      confidence: count > 1 ? 0.58 : 0.48,
      tags: ['keyword']
    }))
    .filter(Boolean);
}

function scoreConceptImportance(concept, text = '') {
  const label = String(concept?.label || concept || '');
  const lower = `${label} ${text}`.toLowerCase();
  let score = 0.42;
  if (TECHNOLOGY_KEYWORDS.some(keyword => keyword.toLowerCase() === label.toLowerCase())) score += 0.2;
  if (/(project|produk|production|deploy|render|database|memory|workflow|goal|insight|roadmap|risiko|keputusan)/i.test(lower)) score += 0.18;
  if (/(penting|utama|prioritas|critical|high|besar|dependency)/i.test(lower)) score += 0.12;
  if (label.length > 12) score += 0.05;
  return graphUtils.clamp01(score, 0.5);
}

function extractConcepts(text = '', options = {}) {
  const clean = graphUtils.compactText(text, options.maxChars || 1800);
  if (!clean || !graphGuards.preventSensitiveGraphStorage(clean)) return [];

  return uniqueConcepts([
    ...extractTechnologies(clean),
    ...extractProjectConcepts(clean),
    ...extractRisks(clean),
    ...extractDecisions(clean),
    ...extractPhases(clean),
    ...extractKeywordConcepts(clean, options)
  ], options.maxConcepts || 12);
}

module.exports = {
  TECHNOLOGY_KEYWORDS,
  extractConcepts,
  extractDecisions,
  extractPhases,
  extractProjectConcepts,
  extractRisks,
  extractTechnologies,
  normalizeConcept,
  scoreConceptImportance
};

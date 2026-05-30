'use strict';

const conceptExtractor = require('./concept-extractor');
const graphUtils = require('./graph-utils');

const RELATIONSHIP_PATTERNS = [
  { relationship: 'depends_on', patterns: [/bergantung\s+pada/i, /depends\s+on/i, /\bbutuh\b/i, /membutuhkan/i, /prasyarat/i] },
  { relationship: 'requires', patterns: [/requires/i, /memerlukan/i, /wajib\s+ada/i, /harus\s+punya/i] },
  { relationship: 'uses', patterns: [/\buntuk\b/i, /\bdipakai\s+untuk\b/i, /\bmenggunakan\b/i, /\buses\b/i, /\bpakai\b/i] },
  { relationship: 'supports', patterns: [/mendukung/i, /supports/i, /memperkuat/i, /menopang/i] },
  { relationship: 'risk_for', patterns: [/risiko\s+untuk/i, /risk\s+for/i, /berisiko/i, /membuat.*berat/i] },
  { relationship: 'contradicts', patterns: [/bertentangan/i, /kontradiksi/i, /contradicts/i, /tidak\s+cocok/i] },
  { relationship: 'improves', patterns: [/meningkatkan/i, /improves/i, /optimasi/i, /lebih\s+baik/i] },
  { relationship: 'blocks', patterns: [/menghambat/i, /\bblocks\b/i, /terhalang/i, /blocker/i] },
  { relationship: 'part_of', patterns: [/bagian\s+dari/i, /part\s+of/i, /komponen/i, /\bmodule\b/i, /\bmodul\b/i] },
  { relationship: 'linked_to_goal', patterns: [/\bgoal\b/i, /tujuan/i, /target/i, /roadmap/i] },
  { relationship: 'linked_to_workflow', patterns: [/\bworkflow\b/i, /alur\s+kerja/i, /step/i] },
  { relationship: 'evidence_for', patterns: [/evidence\s+for/i, /bukti\s+untuk/i, /membuktikan/i, /validasi/i] },
  { relationship: 'derived_from', patterns: [/berasal\s+dari/i, /derived\s+from/i, /berdasarkan/i, /diambil\s+dari/i] },
  { relationship: 'solution_for', patterns: [/solusi\s+untuk/i, /solution\s+for/i, /mengatasi/i] },
  { relationship: 'causes', patterns: [/menyebabkan/i, /\bcauses\b/i, /akibatnya/i] },
  { relationship: 'evolves_into', patterns: [/berkembang\s+menjadi/i, /evolves\s+into/i, /menjadi/i] }
];

function conceptLabel(concept) {
  return graphUtils.normalizeConcept(concept?.label || concept || '');
}

function extractConcepts(text, max = 8) {
  return conceptExtractor.extractConcepts(text, { maxConcepts: max }).map(item => item.label);
}

function classifyConceptType(label, sourceText = '') {
  const text = `${label} ${sourceText}`.toLowerCase();
  if (/(postgres|redis|node\.?js|express|telegram|render|github|docker|next\.?js|react|tailwind|prisma|supabase|neon|groq|mistral|tavily|cloudflare|termux)/i.test(text)) return 'technology';
  if (/(project|proyek|repo|bot|app|sistem|architecture|arsitektur)/i.test(text)) return 'project';
  if (/(goal|tujuan|target|roadmap|milestone)/i.test(text)) return 'goal';
  if (/(workflow|step|langkah|progress|blocker)/i.test(text)) return 'workflow';
  if (/(insight|pelajaran|lesson|catatan)/i.test(text)) return 'insight';
  if (/(evidence|sumber|source|referensi|bukti)/i.test(text)) return 'evidence';
  if (/(keputusan|decision|opsi|rekomendasi)/i.test(text)) return 'decision';
  if (/(asumsi|assumption)/i.test(text)) return 'assumption';
  if (/(error|bug|risk|risiko|crash|gagal|berat|lambat)/i.test(text)) return 'risk';
  if (/(belajar|learning|mentor|roadmap belajar)/i.test(text)) return 'learning_topic';
  if (/(solusi|solution|fix|perbaikan)/i.test(text)) return 'solution';
  return 'concept';
}

function detectRelationship(text, fromLabel = '', toLabel = '') {
  const lower = `${text || ''} ${fromLabel || ''} ${toLabel || ''}`.toLowerCase();

  if (/(postgres|postgresql).{0,60}(memory|memori|persistent|database)/i.test(lower)) return 'supports';
  if (/(redis).{0,60}(cache|caching|temporary|sementara)/i.test(lower)) return 'supports';
  if (/(memory|memori).{0,40}(butuh|membutuhkan|depends|bergantung).{0,40}(postgres|postgresql|database)/i.test(lower)) return 'depends_on';
  if (/(render\s+free\s+tier).{0,60}(limit|risiko|batas|scalability|skala)/i.test(lower)) return 'risk_for';
  if (/(terlalu\s+banyak\s+fitur|scope\s+creep).{0,80}(berat|lambat|debug|stabil)/i.test(lower)) return 'risk_for';

  for (const item of RELATIONSHIP_PATTERNS) {
    if (item.patterns.some(pattern => pattern.test(lower))) return item.relationship;
  }
  return 'related_to';
}

function inferRelationship(conceptA, conceptB, text = '', context = {}) {
  const from = conceptLabel(conceptA);
  const to = conceptLabel(conceptB);
  const evidence = graphUtils.compactText(text || context.summaryText || `${from} dan ${to} muncul dalam konteks yang sama.`, 420);
  const relationship = detectRelationship(text, from, to);
  return {
    fromLabel: from,
    toLabel: to,
    relationship,
    evidence,
    confidence: scoreRelationshipConfidence(relationship, evidence),
    weight: scoreRelationshipStrength(text || evidence, from, to)
  };
}

function scoreRelationshipConfidence(relationship = 'related_to', evidence = '') {
  const text = String(evidence || '').toLowerCase();
  let score = relationship === 'related_to' ? 0.48 : 0.62;
  if (/(untuk|butuh|membutuhkan|bergantung|mendukung|risiko|bertentangan|solusi|menggunakan|dipakai)/i.test(text)) score += 0.16;
  if (/(mungkin|bisa jadi|kemungkinan|asumsi)/i.test(text)) score -= 0.12;
  if (String(evidence || '').length > 80) score += 0.05;
  return graphUtils.clamp01(score, 0.55);
}

function explainRelationship(from, to, relationship, evidence = '') {
  const cleanEvidence = graphUtils.compactText(evidence, 220);
  const label = `${conceptLabel(from)} ${relationship} ${conceptLabel(to)}`;
  return cleanEvidence ? `${label}. Evidence: ${cleanEvidence}` : `${label}. Evidence masih terbatas.`;
}

function scoreRelationshipStrength(text, fromLabel, toLabel) {
  const relevance = graphUtils.textScore(text, `${fromLabel} ${toLabel}`);
  return graphUtils.clamp01(0.45 + relevance * 0.45, 0.5);
}

function detectRelationships(text = '', concepts = [], context = {}, services = {}) {
  const selected = (Array.isArray(concepts) ? concepts : [])
    .map(item => (typeof item === 'string' ? { label: item, type: classifyConceptType(item, text) } : item))
    .filter(item => item?.label)
    .slice(0, context.maxConcepts || 8);
  const relationships = [];

  for (let i = 0; i < selected.length; i += 1) {
    for (let j = i + 1; j < selected.length && relationships.length < 18; j += 1) {
      const rel = inferRelationship(selected[i], selected[j], text, context);
      if (!rel.fromLabel || !rel.toLabel || rel.fromLabel === rel.toLabel) continue;
      relationships.push(rel);
    }
  }

  if (services.log && relationships.length > 14) {
    services.log.debug?.('graph_relationships_limited', { count: relationships.length });
  }

  return relationships;
}

function buildRelationships(text, concepts = []) {
  return detectRelationships(text, concepts, { maxConcepts: 6 });
}

function detectContradictions(userId, concepts = [], services = {}) {
  const graph = services.aiOS?.knowledgeGraph || require('./knowledge-graph');
  const query = concepts.map(conceptLabel).join(' ');
  const snapshot = graph.searchGraph(userId, query, services, 16);
  const edges = (snapshot.edges || []).filter(edge => edge.relationship === 'contradicts');
  return {
    contradictions: edges,
    count: edges.length
  };
}

function detectDependencies(userId, concepts = [], services = {}) {
  const graph = services.aiOS?.knowledgeGraph || require('./knowledge-graph');
  const query = concepts.map(conceptLabel).join(' ');
  const snapshot = graph.searchGraph(userId, query, services, 16);
  const edges = (snapshot.edges || []).filter(edge => ['depends_on', 'requires', 'blocks'].includes(edge.relationship));
  return {
    dependencies: edges,
    count: edges.length
  };
}

module.exports = {
  RELATIONSHIP_PATTERNS,
  buildRelationships,
  classifyConceptType,
  detectContradictions,
  detectDependencies,
  detectRelationship,
  detectRelationships,
  explainRelationship,
  extractConcepts,
  inferRelationship,
  scoreRelationshipConfidence,
  scoreRelationshipStrength
};

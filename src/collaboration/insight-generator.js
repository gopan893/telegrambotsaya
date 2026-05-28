'use strict';

const utils = require('./collaboration-utils');

function createInsight(userId, content, source = 'collaboration', extra = {}) {
  return {
    id: extra.id || `ins_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    userId: String(userId),
    type: extra.type || 'collaboration-insight',
    content: utils.sanitizeText(content || '', 1000),
    source,
    relatedConcepts: Array.isArray(extra.relatedConcepts) ? extra.relatedConcepts.slice(0, 12) : extractConcepts(content),
    confidence: utils.clamp(extra.confidence, 0, 1, 0.66),
    importance: utils.clamp(extra.importance, 0, 1, 0.62),
    createdAt: extra.createdAt || utils.nowIso(),
    updatedAt: utils.nowIso()
  };
}

function extractInsights(input = '', context = {}) {
  const clean = utils.sanitizeText(input, 1200);
  const insights = [];
  if (/terlalu banyak|overwhelm|bingung/i.test(clean)) insights.push('Masalah utama mungkin bukan kurang fitur, tetapi terlalu banyak pilihan aktif.');
  if (/belajar|konsisten|coding/i.test(clean)) insights.push('Progress belajar perlu dibuat kecil, terukur, dan punya feedback cepat.');
  if (/produk|bot|ai|user/i.test(clean)) insights.push('Nilai produk AI ditentukan oleh stabilitas, kebutuhan user, dan kemampuan recover, bukan jumlah fitur saja.');
  if (context.activeGoals?.length) insights.push(`Ada goal aktif yang bisa menjadi anchor: ${context.activeGoals[0].title}.`);
  if (!insights.length) insights.push(`Insight awal: ${utils.compactText(clean || 'topik ini', 160)} perlu dilihat dari fakta, asumsi, risiko, dan next action.`);
  return insights.slice(0, 5);
}

function generateStrategicInsight(input = '', context = {}) {
  return extractInsights(input, context)[0];
}

function generateLearningInsight(input = '', context = {}) {
  if (/belajar|coding|backend|node/i.test(input)) return 'Belajar paling stabil jika konsep, latihan, error log, dan review berjalan dalam siklus kecil.';
  return generateStrategicInsight(input, context);
}

function detectContradictions(input = '', context = {}) {
  const clean = utils.sanitizeText(input, 1200);
  const contradictions = [];
  if (/cepat/i.test(clean) && /sempurna|lengkap|semua/i.test(clean)) contradictions.push('Ingin cepat sekaligus lengkap bisa bertentangan; perlu prioritas.');
  if (/hemat/i.test(clean) && /semua fitur|full/i.test(clean)) contradictions.push('Hemat resource dan fitur sangat banyak perlu trade-off eksplisit.');
  return contradictions;
}

async function saveInsightIfImportant(userId, insight, services = {}) {
  if (!insight?.content || insight.importance < 0.5) return { ok: false, reason: 'INSIGHT_NOT_IMPORTANT' };
  const aiOS = services.aiOS || safeRequireAIOS();
  if (!aiOS?.insightStore?.createInsight) return { ok: false, reason: 'INSIGHT_STORE_UNAVAILABLE' };
  try {
    return await aiOS.insightStore.createInsight(userId, {
      type: insight.type || 'collaboration',
      content: insight.content,
      source: insight.source || 'collaboration',
      relatedConcepts: insight.relatedConcepts || [],
      confidence: insight.confidence,
      importance: insight.importance
    }, services);
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}

function formatInsightResponse(input = '', context = {}, userId = 'unknown') {
  const main = extractInsights(input, context);
  const contradictions = detectContradictions(input, context);
  const confidence = context.relevantMemory?.length ? 0.72 : 0.63;
  return {
    insight: createInsight(userId, main[0], 'insight-command', {
      confidence,
      importance: 0.7,
      relatedConcepts: extractConcepts(input)
    }),
    text: [
      'Insight Generator',
      '',
      'Insight utama:',
      `- ${main[0]}`,
      '',
      'Pola yang terlihat:',
      utils.bullet(main.slice(1)),
      '',
      'Hubungan konsep:',
      utils.bullet(extractConcepts(input).map(item => `${item} terkait dengan keputusan/progress/konteks user.`)),
      '',
      'Kemungkinan kontradiksi:',
      utils.bullet(contradictions),
      '',
      'Kenapa ini penting:',
      '- Insight yang bagus membantu memilih next action, bukan hanya menambah ide.',
      '',
      `Confidence: ${utils.formatConfidence(confidence)}`,
      '',
      'Next action:',
      '- Ubah insight ini menjadi satu langkah kecil atau satu pertanyaan verifikasi.'
    ].join('\n')
  };
}

function extractConcepts(text = '') {
  return utils.sanitizeText(text, 600)
    .toLowerCase()
    .split(/[^a-z0-9\u00C0-\u024F]+/i)
    .filter(word => word.length >= 4)
    .slice(0, 8);
}

function safeRequireAIOS() {
  try {
    return require('../ai-os');
  } catch (_) {
    return null;
  }
}

module.exports = {
  createInsight,
  detectContradictions,
  extractInsights,
  formatInsightResponse,
  generateLearningInsight,
  generateStrategicInsight,
  saveInsightIfImportant
};

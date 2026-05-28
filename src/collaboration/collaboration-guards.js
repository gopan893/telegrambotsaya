'use strict';

const utils = require('./collaboration-utils');

const HIGH_STAKES = [
  { type: 'medical', pattern: /(dokter|obat|diagnosis|penyakit|sakit parah|bunuh diri|self harm|depresi berat|sesak|nyeri dada|pendarahan)/i },
  { type: 'legal', pattern: /(hukum|legal|kontrak|gugatan|pidana|pengadilan|pengacara|cerai|imigrasi|visa)/i },
  { type: 'financial', pattern: /(investasi|saham|crypto|utang|pinjaman|pajak|asuransi|trading|keuangan besar)/i },
  { type: 'safety', pattern: /(darurat|keselamatan|kecelakaan|kekerasan|ancaman|senjata|kebakaran)/i },
  { type: 'employment', pattern: /(resign|phk|dipecat|kontrak kerja|karier besar|pindah kerja)/i },
  { type: 'business_irreversible', pattern: /(jual bisnis|tutup usaha|pinjam modal besar|keputusan besar|irreversible|tidak bisa dibalik)/i }
];

function sanitizeInput(input = '', max = 1800) {
  return utils.sanitizeText(input, max);
}

function detectHighStakesTopic(input = '') {
  const matches = HIGH_STAKES.filter(item => item.pattern.test(String(input || '')));
  return {
    highStakes: matches.length > 0,
    categories: matches.map(item => item.type)
  };
}

function preventOverdependence(input = '') {
  if (/(putuskan untuk saya|terserah kamu sepenuhnya|ambil keputusan final|kamu yang menentukan)/i.test(String(input || ''))) {
    return 'Aku bisa bantu menyusun opsi, risiko, dan trade-off, tapi keputusan final tetap sebaiknya kamu ambil.';
  }
  return '';
}

function addLowConfidenceWarning(confidence = 0.5, evidenceSummary = '') {
  if (confidence >= 0.56 && evidenceSummary) return '';
  return 'Catatan: confidence terbatas karena evidence/konteks belum lengkap. Gunakan ini sebagai kerangka berpikir awal.';
}

function preventCognitiveOverload(sections = [], max = 10) {
  return Array.isArray(sections) ? sections.slice(0, max) : [];
}

function preventRunawayAnalysis(input = '', options = {}) {
  const clean = sanitizeInput(input, options.maxInput || 1800);
  return {
    ok: clean.length <= (options.maxInput || 1800),
    input: clean,
    reason: clean.length > (options.maxInput || 1800) ? 'Input terlalu panjang untuk collaboration MVP.' : ''
  };
}

function limitOutputSections(text = '', maxLines = 80) {
  return utils.limitLines(text, maxLines);
}

function shouldAskClarification(input = '') {
  const clean = sanitizeInput(input, 500);
  if (!clean) return true;
  if (clean.length < 12 && /^(ini|itu|yang tadi|bingung|tolong|bantu)$/i.test(clean)) return true;
  return false;
}

function buildSafetyNote(input = '', confidence = 0.65) {
  const high = detectHighStakesTopic(input);
  const overdependence = preventOverdependence(input);
  const notes = [];
  if (high.highStakes) {
    notes.push(`Topik ini sensitif (${high.categories.join(', ')}). Verifikasi dengan profesional/sumber tepercaya sebelum mengambil keputusan penting.`);
  }
  if (overdependence) notes.push(overdependence);
  const low = addLowConfidenceWarning(confidence, '');
  if (confidence < 0.56 && low) notes.push(low);
  return notes.join('\n');
}

function addHumanJudgmentNote(input = '', confidence = 0.65) {
  return buildSafetyNote(input, confidence);
}

function isHighStakes(input = '') {
  return detectHighStakesTopic(input).highStakes;
}

function preventOverAnalysis(input = '') {
  return utils.sanitizeText(input, 200).length < 80;
}

module.exports = {
  addHumanJudgmentNote,
  addLowConfidenceWarning,
  buildSafetyNote,
  detectHighStakesTopic,
  isHighStakes,
  limitOutputSections,
  preventCognitiveOverload,
  preventOverAnalysis,
  preventOverdependence,
  preventRunawayAnalysis,
  sanitizeInput,
  shouldAskClarification
};

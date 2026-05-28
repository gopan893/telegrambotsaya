'use strict';

const utils = require('./collaboration-utils');
const guards = require('./collaboration-guards');

function frameDecision(input = '', context = {}) {
  const clean = guards.sanitizeInput(input);
  return {
    decision: clean || 'Keputusan belum dijelaskan.',
    constraints: utils.getContextFacts(context),
    criteria: ['Dampak ke tujuan utama', 'Risiko', 'Biaya/waktu', 'Reversibility', 'Kemudahan maintenance', 'Kecepatan belajar']
  };
}

function mapOptions(input = '') {
  const clean = guards.sanitizeInput(input).toLowerCase();
  if (/postgres|redis/i.test(clean)) {
    return [
      'PostgreSQL untuk data persistent jangka panjang.',
      'Redis untuk cache/state sementara.',
      'Hybrid: PostgreSQL sebagai source of truth, Redis sebagai akselerator.'
    ];
  }
  if (/atau| vs | pilih/i.test(clean)) {
    return ['Opsi A: pilih pendekatan pertama.', 'Opsi B: pilih pendekatan kedua.', 'Opsi C: uji kecil dua opsi sebelum komit.'];
  }
  return ['Lakukan sekarang dalam versi kecil.', 'Tunda sambil mencari data tambahan.', 'Uji eksperimen terbatas sebelum keputusan permanen.'];
}

function evaluateTradeOffs(input = '') {
  const clean = guards.sanitizeInput(input).toLowerCase();
  const tradeOffs = ['Kecepatan vs validasi', 'Sederhana vs fleksibel', 'Biaya sekarang vs biaya maintenance'];
  if (/postgres|redis|database/i.test(clean)) tradeOffs.push('Durability PostgreSQL vs latency/cache Redis.');
  return tradeOffs;
}

function buildRiskMatrix(input = '') {
  return [
    'High impact + irreversible: butuh validasi kuat dan mungkin konsultasi.',
    'High impact + reversible: boleh eksperimen, tapi pasang rollback.',
    'Low impact + irreversible: pikirkan ulang karena nilai belajarnya mungkin kecil.',
    'Low impact + reversible: cocok untuk eksperimen cepat.'
  ];
}

function suggestNextDecisionStep(input = '') {
  if (/postgres|redis/i.test(input)) return 'Gunakan PostgreSQL untuk memory persistent, Redis untuk cache/session. Validasi dengan satu use case nyata.';
  return 'Beri skor 1-5 untuk tiap opsi berdasarkan 2 kriteria paling penting, lalu pilih eksperimen kecil yang reversible.';
}

function analyzeDecision(input = '', context = {}, services = {}) {
  const frame = frameDecision(input, context);
  const options = mapOptions(input, context);
  const confidence = frame.constraints.length ? 0.72 : 0.64;
  return {
    ...frame,
    options,
    tradeOffs: evaluateTradeOffs(input, context),
    risks: ['Overconfidence jika evidence kurang.', 'Opportunity cost karena fokus ke satu opsi.', 'Risiko maintenance jika memilih solusi terlalu kompleks.'],
    reversibility: options.map(option => `${option}: ${/hybrid|uji|eksperimen|redis/i.test(option) ? 'lebih reversible' : 'perlu rencana migrasi'}`),
    opportunityCost: 'Memilih satu opsi berarti menunda opsi lain; pilih yang paling dekat dengan outcome utama.',
    nextAction: suggestNextDecisionStep(input, context),
    confidence
  };
}

function format(result = {}) {
  const text = [
    'Decision Support',
    '',
    'Keputusan yang sedang dihadapi:',
    `- ${result.decision || '-'}`,
    '',
    'Opsi:',
    utils.bullet(result.options),
    '',
    'Kriteria:',
    utils.bullet(result.criteria),
    '',
    'Trade-off:',
    utils.bullet(result.tradeOffs),
    '',
    'Risiko:',
    utils.bullet(result.risks),
    '',
    'Reversible vs irreversible:',
    utils.bullet(result.reversibility),
    '',
    'Opportunity cost:',
    `- ${result.opportunityCost || '-'}`,
    '',
    'Rekomendasi proses berpikir:',
    '- Jangan pilih karena terasa paling canggih; pilih berdasarkan outcome, risiko, dan reversibility.',
    '',
    'Next action:',
    `- ${result.nextAction || '-'}`,
    '',
    `Confidence: ${utils.formatConfidence(result.confidence || 0.6)}`,
    'Keputusan final tetap di kamu.'
  ].join('\n');
  const note = guards.buildSafetyNote(result.decision || '', result.confidence || 0.6);
  return note ? `${text}\n\n${note}` : text;
}

module.exports = {
  analyzeDecision,
  buildRiskMatrix,
  evaluateTradeOffs,
  format,
  frameDecision,
  mapOptions,
  suggestNextDecisionStep
};

'use strict';

const framework = require('./deep-analysis-framework');

function analyzeDecision(text = '') {
  const base = framework.analyzeProblem(text);
  return {
    ...base,
    criteria: ['Dampak', 'Risiko', 'Biaya', 'Reversibility', 'Kecepatan belajar'],
    options: ['Opsi A: lakukan kecil dulu', 'Opsi B: tunggu data tambahan', 'Opsi C: uji dua pendekatan terbatas'],
    riskMatrix: [
      'High impact + irreversible: butuh validasi lebih kuat.',
      'Low impact + reversible: aman untuk eksperimen cepat.'
    ],
    opportunityCost: 'Setiap pilihan mengorbankan fokus pada opsi lain; pilih yang paling dekat ke tujuan utama.',
    confidence: 0.66
  };
}

function format(result) {
  return [
    `Frame keputusan: ${result.topic}`,
    '',
    'Kriteria:',
    result.bullet(result.criteria),
    '',
    'Opsi:',
    result.bullet(result.options),
    '',
    'Trade-off:',
    result.bullet(['Cepat belajar vs risiko salah arah', 'Sederhana vs fleksibel', 'Biaya sekarang vs biaya maintenance']),
    '',
    'Risk matrix:',
    result.bullet(result.riskMatrix),
    '',
    `Opportunity cost: ${result.opportunityCost}`,
    'Next step: pilih 2 kriteria terpenting, lalu beri skor tiap opsi 1-5.',
    `Confidence: ${result.confidence.toFixed(2)}`,
    'Keputusan final tetap di kamu.'
  ].join('\n');
}

module.exports = {
  analyzeDecision,
  format
};

'use strict';

const framework = require('./deep-analysis-framework');

function analyze(text = '') {
  const base = framework.analyzeProblem(text);
  return {
    ...base,
    options: [
      'Mulai dari langkah kecil yang reversible.',
      'Bangun baseline/metrik sebelum optimasi besar.',
      'Pisahkan eksperimen dari keputusan permanen.'
    ],
    tradeOffs: [
      'Kecepatan vs kualitas validasi.',
      'Otomasi vs kontrol manusia.',
      'Kompleksitas sistem vs kemudahan maintenance.'
    ],
    secondOrderEffects: [
      'Keputusan arsitektur hari ini akan memengaruhi biaya maintenance nanti.',
      'Metrik yang salah bisa mendorong optimasi yang salah.'
    ],
    recommendation: 'Pilih opsi yang paling reversible, terukur, dan mengurangi risiko terbesar lebih dulu.',
    confidence: 0.68
  };
}

function format(result) {
  return [
    `Ringkasan masalah: ${result.topic}`,
    '',
    'Fakta diketahui:',
    result.bullet(result.knownFacts),
    '',
    'Asumsi:',
    result.bullet(result.assumptions),
    '',
    'Risiko:',
    result.bullet(result.risks),
    '',
    'Trade-off:',
    result.bullet(result.tradeOffs),
    '',
    'Opsi strategi:',
    result.bullet(result.options),
    '',
    'Second-order effects:',
    result.bullet(result.secondOrderEffects),
    '',
    `Rekomendasi: ${result.recommendation}`,
    'Next action: tulis constraint utama dan metrik sukses sebelum eksekusi.',
    `Confidence: ${result.confidence.toFixed(2)}`
  ].join('\n');
}

module.exports = {
  analyze,
  format
};

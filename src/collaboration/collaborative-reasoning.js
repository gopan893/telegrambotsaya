'use strict';

function compare(text = '') {
  return [
    `Topik: ${String(text || '').trim()}`,
    '',
    'Sudut pandang A: optimalkan solusi paling sederhana.',
    'Sudut pandang B: siapkan arsitektur agar bisa berkembang.',
    'Sintesis: mulai sederhana, tetapi pasang boundary dan telemetry sejak awal.',
    'Consensus confidence: 0.68'
  ].join('\n');
}

module.exports = {
  compare
};

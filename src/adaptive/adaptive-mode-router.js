'use strict';

const { detectComplexity, hasAny } = require('./intent-complexity-detector');
const guards = require('./adaptive-guards');

function routeMessage(input = {}) {
  const text = String(input.text || '');
  const lower = text.toLowerCase();
  const complexity = detectComplexity(text);
  let mode = 'auto';
  let reason = 'Pesan sederhana, gunakan assistant biasa.';
  let confidence = 0.55;

  if (hasAny(lower, ['error', 'stack trace', 'bug', 'crash', 'tidak jalan', 'npm error', 'referenceerror'])) {
    mode = 'coding-debugging';
    reason = 'Pesan terlihat seperti debugging/coding.';
    confidence = 0.82;
  } else if (hasAny(lower, ['lambat', 'latency', 'memory', 'ram', 'render', 'deploy', 'health', 'diagnostic'])) {
    mode = 'system-analysis';
    reason = 'Pesan berkaitan dengan operasi, performa, atau deployment.';
    confidence = 0.78;
  } else if (hasAny(lower, ['pilih', 'lebih baik', 'keputusan', 'opsi', 'alternatif', 'redis atau postgresql'])) {
    mode = 'decision-support';
    reason = 'Pesan meminta bantuan mengambil keputusan.';
    confidence = 0.8;
  } else if (hasAny(lower, ['belajar', 'ajarkan', 'roadmap belajar', 'dari nol', 'mentor'])) {
    mode = 'learning-mentor';
    reason = 'Pesan meminta pembelajaran atau roadmap.';
    confidence = 0.8;
  } else if (hasAny(lower, ['risiko', 'strategi', 'roadmap', 'trade-off', 'asumsi', 'second-order'])) {
    mode = 'strategic-thinking';
    reason = 'Pesan membutuhkan strategic reasoning.';
    confidence = 0.78;
  } else if (hasAny(lower, ['renungkan', 'refleksi', 'blind spot', 'pola pikir', 'kenapa saya'])) {
    mode = 'meta-reasoning';
    reason = 'Pesan membutuhkan refleksi/metacognition.';
    confidence = 0.74;
  } else if (complexity.level === 'high') {
    mode = 'strategic-thinking';
    reason = 'Kompleksitas tinggi, aktifkan reasoning strategis.';
    confidence = 0.68;
  }

  return guards.capConfidence({
    mode,
    reason,
    confidence,
    complexity
  }, text);
}

module.exports = {
  routeMessage
};

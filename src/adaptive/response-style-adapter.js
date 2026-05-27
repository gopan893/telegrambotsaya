'use strict';

function getStyleForMode(mode = 'auto') {
  const map = {
    'learning-mentor': 'Jelaskan bertahap, beri contoh, dan ukur pemahaman.',
    'strategic-thinking': 'Beri ringkasan, opsi, trade-off, risiko, dan next action.',
    'system-analysis': 'Fokus root cause, bottleneck, prioritas, dan langkah verifikasi.',
    'coding-debugging': 'Fokus penyebab bug, lokasi masalah, patch kecil, dan test.',
    'decision-support': 'Bantu membingkai keputusan tanpa mengambil keputusan final.',
    'governance-review': 'Berikan batasan, risiko, confidence, dan anjuran verifikasi.',
    'mentor-intelligence': 'Gunakan gaya mentor yang jelas dan membangun pola pikir.'
  };
  return map[mode] || 'Jawab natural, ringkas, dan sesuai bahasa user.';
}

function buildPromptHint(decision = {}) {
  const mode = decision.mode || 'auto';
  return [
    `Adaptive mode: ${mode}`,
    `Alasan: ${decision.reason || '-'}`,
    `Confidence: ${Number(decision.confidence || 0).toFixed(2)}`,
    getStyleForMode(mode),
    decision.safetyNote ? `Safety note: ${decision.safetyNote}` : ''
  ].filter(Boolean).join('\n');
}

module.exports = {
  getStyleForMode,
  buildPromptHint
};

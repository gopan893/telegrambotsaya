'use strict';

const multiDeviceUX = require('../ux/multi-device-response');

function getStyleForMode(mode = 'auto') {
  const map = {
    simple: 'Jawab ringkas, natural, dan langsung ke inti.',
    coding: 'Langsung ke penyebab, solusi, dan kode jika perlu. Sertakan test singkat bila relevan.',
    learning: 'Jelaskan bertahap, beri contoh pendek, lalu latihan atau next step.',
    strategic: 'Beri opsi, risiko, trade-off, prioritas, dan next action.',
    decision: 'Bantu membingkai keputusan: kriteria, opsi, trade-off, risiko, dan rekomendasi hati-hati.',
    reflection: 'Jawab empatik, bantu melihat pola, lalu beri pertanyaan reflektif singkat.',
    research: 'Bedakan fakta, inferensi, dan ketidakpastian. Sebutkan bila perlu validasi sumber.',
    ops: 'Fokus root cause, health, diagnostics, langkah verifikasi, dan mitigasi aman.',
    health: 'Jawab empatik, beri saran umum ringan, sebutkan gejala serius yang perlu bantuan medis, dan jangan membuat diagnosis pasti.',
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
    multiDeviceUX.getCompactPromptHint(),
    decision.safetyNote ? `Safety note: ${decision.safetyNote}` : ''
  ].filter(Boolean).join('\n');
}

module.exports = {
  getStyleForMode,
  buildPromptHint
};

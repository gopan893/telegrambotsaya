'use strict';

const { detectComplexity, hasAny } = require('./intent-complexity-detector');
const guards = require('./adaptive-guards');

const SIGNALS = {
  health: [
    'pusing',
    'sakit kepala',
    'mual',
    'demam',
    'batuk',
    'flu',
    'lemas',
    'capek',
    'sakit perut',
    'tidak enak badan',
    'obat',
    'dokter'
  ],
  coding: [
    'error',
    'stack trace',
    'bug',
    'crash',
    'tidak jalan',
    'npm error',
    'referenceerror',
    'syntaxerror',
    'kode',
    'coding',
    'javascript',
    'node',
    'node.js',
    'react',
    'next.js',
    'nextjs',
    'express',
    'api',
    'login',
    'auth'
  ],
  ops: [
    'lambat',
    'latency',
    'memory',
    'ram',
    'render',
    'deploy',
    'deployment',
    'health',
    'diagnostic',
    'diagnostics',
    'benchmark',
    'webhook',
    'redis',
    'postgresql',
    'database_url',
    'env',
    'server'
  ],
  decision: [
    'pilih',
    'lebih baik',
    'keputusan',
    'opsi',
    'alternatif',
    'rekomendasi',
    'sebaiknya',
    'vs',
    'atau'
  ],
  reflection: [
    'renungkan',
    'refleksi',
    'blind spot',
    'pola pikir',
    'kenapa saya',
    'sulit konsisten',
    'kebiasaan',
    'motivasi',
    'bingung dengan diri'
  ],
  learning: [
    'belajar',
    'ajarkan',
    'roadmap belajar',
    'dari nol',
    'mentor',
    'latihan',
    'materi',
    'pahami',
    'jelaskan konsep'
  ],
  strategic: [
    'risiko',
    'strategi',
    'roadmap',
    'trade-off',
    'trade off',
    'asumsi',
    'second-order',
    'jangka panjang',
    'rencana besar',
    'skala'
  ],
  research: [
    'riset',
    'sumber',
    'validasi',
    'fakta',
    'referensi',
    'search',
    'cari sumber',
    'berita terbaru',
    'terbaru',
    'update terbaru'
  ]
};

function routeMessage(input = {}) {
  const text = String(input.text || '');
  const lower = text.toLowerCase();
  const conversationState = input.conversationState || {};
  const complexity = detectComplexity(text);
  let mode = 'simple';
  let reason = 'Pesan sederhana, gunakan assistant ringan.';
  let confidence = 0.55;

  if (hasAny(lower, SIGNALS.health)) {
    mode = 'health';
    reason = 'Pesan berisi keluhan kesehatan, gunakan jawaban empatik dan aman.';
    confidence = 0.84;
  } else if (hasAny(lower, SIGNALS.reflection)) {
    mode = 'reflection';
    reason = 'Pesan meminta refleksi atau bantuan memahami pola diri.';
    confidence = 0.78;
  } else if (hasAny(lower, SIGNALS.coding)) {
    mode = 'coding';
    reason = 'Pesan terlihat seperti debugging/coding.';
    confidence = 0.82;
  } else if (hasAny(lower, SIGNALS.decision)) {
    mode = 'decision';
    reason = 'Pesan meminta bantuan mengambil keputusan.';
    confidence = 0.8;
  } else if (hasAny(lower, SIGNALS.ops)) {
    mode = 'ops';
    reason = 'Pesan berkaitan dengan operasi, performa, atau deployment.';
    confidence = 0.78;
  } else if (hasAny(lower, SIGNALS.learning)) {
    mode = 'learning';
    reason = 'Pesan meminta pembelajaran atau roadmap.';
    confidence = 0.8;
  } else if (hasAny(lower, SIGNALS.research)) {
    mode = 'research';
    reason = 'Pesan membutuhkan riset, validasi sumber, atau informasi terbaru.';
    confidence = 0.72;
  } else if (hasAny(lower, SIGNALS.strategic)) {
    mode = 'strategic';
    reason = 'Pesan membutuhkan strategic reasoning.';
    confidence = 0.78;
  } else if (complexity.level === 'high') {
    mode = 'strategic';
    reason = 'Kompleksitas tinggi, aktifkan reasoning strategis.';
    confidence = 0.68;
  }

  if (conversationState.action === 'continue' && mode === 'simple') {
    mode = 'simple';
    reason = 'Pesan adalah follow-up; gunakan konteks percakapan tanpa pipeline berat.';
    confidence = Math.max(confidence, 0.7);
  }

  if (conversationState.action === 'new_topic' && conversationState.newIntent && mode === 'simple') {
    mode = conversationState.newIntent === 'general_question' ? 'simple' : conversationState.newIntent;
    reason = 'Conversation layer mendeteksi topik baru yang jelas.';
    confidence = Math.max(confidence, Number(conversationState.confidence || 0.72));
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

'use strict';

const utils = require('./collaboration-utils');
const guards = require('./collaboration-guards');

function analyzeTradeOffs(input = '', context = {}) {
  const clean = guards.sanitizeInput(input);
  const tradeOffs = [
    'Kecepatan eksekusi vs kualitas validasi.',
    'Solusi sederhana vs fleksibilitas jangka panjang.',
    'Otomasi AI vs kontrol manusia.',
    'Fitur banyak vs stabilitas dan maintainability.'
  ];
  if (/postgres|redis|database|storage|memory/i.test(clean)) {
    tradeOffs.push('Persistent storage kuat vs cache cepat yang sifatnya sementara.');
  }
  if (context.activeWorkflows?.length) {
    tradeOffs.push('Menambah workflow baru vs menyelesaikan workflow aktif dulu.');
  }
  return tradeOffs.slice(0, 6);
}

function analyzeRisks(input = '', context = {}) {
  const clean = guards.sanitizeInput(input);
  const risks = [
    'Scope melebar sehingga energi habis sebelum fitur inti stabil.',
    'Evidence kurang sehingga rekomendasi terlalu percaya diri.',
    'Tidak ada metrik sukses sehingga sulit menilai progress.'
  ];
  if (/produk|user|publik|banyak user/i.test(clean)) risks.push('Kebutuhan user nyata belum tentu sama dengan asumsi awal.');
  if (/deploy|render|server|production|api/i.test(clean)) risks.push('Risiko operasional: limit Render, secret env, latency provider, dan restart server.');
  if (/memory|ai|belajar|autonomous/i.test(clean)) risks.push('Memory/AI bisa menyimpan noise jika tidak ada pruning dan confidence.');
  return risks.slice(0, 6);
}

function generateRoadmap(input = '', context = {}) {
  const clean = guards.sanitizeInput(input);
  const roadmap = [
    'Tentukan outcome utama dan metrik sukses.',
    'Pilih satu bagian yang paling berisiko untuk divalidasi dulu.',
    'Buat versi kecil yang bisa diuji.',
    'Ukur hasil, catat pelajaran, lalu iterasi.',
    'Baru tambah automasi atau fitur kompleks setelah fondasi stabil.'
  ];
  if (/bot|ai|telegram|produk/i.test(clean)) {
    roadmap.splice(2, 0, 'Pastikan chat normal, command lama, storage, dan fallback tetap stabil.');
  }
  if (context.activeGoals?.length) {
    roadmap.unshift(`Sinkronkan dengan goal aktif: ${context.activeGoals.map(g => g.title).slice(0, 2).join(', ')}.`);
  }
  return roadmap.slice(0, 7);
}

function identifySecondOrderEffects(input = '') {
  const clean = guards.sanitizeInput(input);
  const effects = [
    'Keputusan arsitektur hari ini akan menentukan mudah/sulitnya maintenance nanti.',
    'Metrik yang salah bisa membuat optimasi terlihat bagus tapi tidak berguna.',
    'Semakin autonomous sistem, semakin penting audit, permission, dan fallback.'
  ];
  if (/belajar|skill|coding/i.test(clean)) effects.push('Cara belajar yang terlalu luas bisa membuat progress terasa lambat meski aktivitas banyak.');
  if (/database|storage|memory/i.test(clean)) effects.push('Pilihan storage memengaruhi biaya migrasi dan kualitas memory jangka panjang.');
  return effects.slice(0, 5);
}

function analyzeStrategy(input = '', context = {}) {
  const clean = guards.sanitizeInput(input);
  const contextFacts = utils.getContextFacts(context);
  const facts = [
    clean ? `Masalah/tujuan yang disebut: ${utils.compactText(clean, 220)}` : 'Masalah belum dijelaskan.',
    ...contextFacts
  ];
  const assumptions = [
    'Informasi yang tersedia belum lengkap.',
    'Solusi terbaik bergantung pada constraint waktu, biaya, skill, dan risiko.',
    'Keputusan final tetap di user.'
  ];
  const confidence = contextFacts.length ? 0.72 : 0.64;
  const options = [
    'Mulai kecil dan reversible.',
    'Bangun baseline/metrik sebelum optimasi besar.',
    'Pisahkan eksperimen dari keputusan permanen.'
  ];
  return {
    problemSummary: clean || 'Masalah belum dijelaskan.',
    goal: inferGoal(clean),
    facts,
    assumptions,
    risks: analyzeRisks(clean, context),
    tradeOffs: analyzeTradeOffs(clean, context),
    options,
    secondOrderEffects: identifySecondOrderEffects(clean),
    opportunityCost: 'Memilih satu arah berarti menunda arah lain; prioritaskan yang paling dekat ke outcome utama.',
    recommendation: 'Dengan informasi saat ini, rekomendasi paling masuk akal adalah mulai dari langkah kecil yang reversible dan punya metrik sukses jelas.',
    nextAction: 'Tulis 1 outcome, 1 metrik sukses, dan 1 eksperimen kecil untuk 24 jam ke depan.',
    confidence
  };
}

function inferGoal(input = '') {
  if (/belajar|roadmap/i.test(input)) return 'Membuat proses belajar yang terukur dan realistis.';
  if (/produk|user|bisnis/i.test(input)) return 'Mengubah ide menjadi produk yang bisa diuji user.';
  if (/bot|ai|system|sistem/i.test(input)) return 'Meningkatkan stabilitas dan nilai praktis sistem AI.';
  if (/pilih|keputusan|opsi/i.test(input)) return 'Membuat keputusan dengan trade-off yang jelas.';
  return 'Menemukan arah yang paling aman, jelas, dan bisa dieksekusi.';
}

function format(result = {}) {
  const confidence = result.confidence || 0.6;
  const text = [
    'Analisis Strategis',
    '',
    'Ringkasan masalah:',
    `- ${result.problemSummary || '-'}`,
    '',
    'Tujuan:',
    `- ${result.goal || '-'}`,
    '',
    'Fakta yang diketahui:',
    utils.bullet(result.facts),
    '',
    'Asumsi utama:',
    utils.bullet(result.assumptions),
    '',
    'Risiko:',
    utils.bullet(result.risks),
    '',
    'Trade-off:',
    utils.bullet(result.tradeOffs),
    '',
    'Opsi strategi:',
    utils.bullet(result.options),
    '',
    'Second-order effects:',
    utils.bullet(result.secondOrderEffects),
    '',
    'Opportunity cost:',
    `- ${result.opportunityCost || '-'}`,
    '',
    'Rekomendasi:',
    `- ${result.recommendation || '-'}`,
    '',
    'Next action:',
    `- ${result.nextAction || '-'}`,
    '',
    `Confidence: ${utils.formatConfidence(confidence)}`
  ].join('\n');
  const note = guards.buildSafetyNote(result.problemSummary || '', confidence);
  return note ? `${text}\n\n${note}` : text;
}

function analyze(input = '', context = {}, services = {}) {
  return analyzeStrategy(input, context, services);
}

module.exports = {
  analyze,
  analyzeRisks,
  analyzeStrategy,
  analyzeTradeOffs,
  format,
  generateRoadmap,
  identifySecondOrderEffects
};

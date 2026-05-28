'use strict';

const utils = require('./collaboration-utils');
const guards = require('./collaboration-guards');

function clarifyProblem(input = '', context = {}) {
  const clean = guards.sanitizeInput(input);
  const unclear = guards.shouldAskClarification(clean);
  return {
    summary: clean || 'Masalah belum dijelaskan.',
    clear: utils.getContextFacts(context).concat(clean ? [`Topik utama: ${utils.compactText(clean, 160)}`] : []),
    unclear: unclear
      ? ['Outcome yang diinginkan belum jelas.', 'Batasan waktu/biaya/risiko belum disebutkan.']
      : ['Prioritas utama belum tentu sama dengan fitur yang terlihat paling menarik.', 'Metrik sukses belum eksplisit.'],
    clarificationQuestions: unclear
      ? ['Kamu ingin hasil akhirnya seperti apa?', 'Bagian mana yang paling membuat kamu bingung?']
      : ['Apa tanda paling konkret bahwa masalah ini sudah selesai?']
  };
}

function decomposeProblem(input = '', context = {}) {
  const clean = guards.sanitizeInput(input);
  const parts = [
    'Tujuan: definisikan hasil akhir yang bisa diamati.',
    'Konteks: kumpulkan fakta, constraint, dan memory/project yang relevan.',
    'Hambatan: cari risiko, bottleneck, dan asumsi rapuh.',
    'Pilihan: bandingkan beberapa pendekatan kecil.',
    'Eksekusi: pilih satu next action yang reversible.'
  ];
  if (/kode|error|bug|deploy|server|bot/i.test(clean)) parts.push('Verifikasi teknis: reproduksi error, cek log, lalu test perubahan kecil.');
  if (context.activeWorkflows?.length) parts.push('Kontinuitas: kaitkan dengan workflow aktif agar tidak mulai dari nol.');
  return parts.slice(0, 6);
}

function expandIdeas(input = '', context = {}) {
  const clean = guards.sanitizeInput(input);
  const ideas = [
    'Mulai dari versi kecil yang bisa diuji hari ini.',
    'Tulis daftar asumsi sebelum memilih solusi.',
    'Cari satu bukti yang bisa membatalkan ide ini.',
    'Pisahkan hal penting, mendesak, dan sekadar menarik.'
  ];
  if (/belajar|roadmap/i.test(clean)) ideas.push('Ubah tujuan belajar menjadi latihan kecil dan review mingguan.');
  if (/produk|user|bisnis/i.test(clean)) ideas.push('Validasi kebutuhan user sebelum menambah fitur.');
  if (context.activeGoals?.length) ideas.push('Pilih satu goal aktif sebagai anchor keputusan.');
  return ideas.slice(0, 6);
}

function generateGuidingQuestions(input = '', context = {}) {
  const questions = [
    'Apa hasil akhir yang paling kamu inginkan?',
    'Apa constraint yang tidak boleh dilanggar?',
    'Apa risiko terbesar kalau kita salah?',
    'Apa langkah kecil yang bisa memberi data baru?'
  ];
  if (context.relevantMemory?.length) questions.push('Memory lama mana yang masih benar dan mana yang perlu diperbarui?');
  return questions.slice(0, guards.shouldAskClarification(input) ? 2 : 5);
}

function synthesizeThinking(input = '', context = {}) {
  const clarified = clarifyProblem(input, context);
  const confidence = guards.shouldAskClarification(input) ? 0.48 : 0.68;
  const text = [
    'Thinking Partner',
    '',
    'Ringkasan masalah:',
    `- ${clarified.summary}`,
    '',
    'Yang sudah jelas:',
    utils.bullet(clarified.clear),
    '',
    'Yang belum jelas:',
    utils.bullet(clarified.unclear),
    '',
    'Pecahan masalah:',
    utils.bullet(decomposeProblem(input, context)),
    '',
    'Beberapa kemungkinan arah:',
    utils.bullet(expandIdeas(input, context)),
    '',
    'Pertanyaan klarifikasi:',
    utils.bullet(clarified.clarificationQuestions),
    '',
    'Langkah kecil berikutnya:',
    '- Tulis outcome 1 kalimat, lalu pilih satu aksi kecil yang bisa diuji hari ini.',
    '',
    `Confidence: ${utils.formatConfidence(confidence)}`
  ].join('\n');
  const note = guards.buildSafetyNote(input, confidence);
  return note ? `${text}\n\n${note}` : text;
}

function think(input = '', context = {}, services = {}) {
  return synthesizeThinking(input, context, services);
}

module.exports = {
  clarifyProblem,
  decomposeProblem,
  expandIdeas,
  generateGuidingQuestions,
  synthesizeThinking,
  think
};

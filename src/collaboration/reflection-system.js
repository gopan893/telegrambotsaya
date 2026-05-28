'use strict';

const utils = require('./collaboration-utils');
const guards = require('./collaboration-guards');

function dailyReflection(input = '', context = {}) {
  const clean = guards.sanitizeInput(input || 'hari ini');
  return buildReflection(clean, context, 'daily');
}

function decisionReflection(input = '', context = {}) {
  return buildReflection(input, context, 'decision');
}

function learningReflection(input = '', context = {}) {
  return buildReflection(input, context, 'learning');
}

function progressReflection(input = '', context = {}) {
  return buildReflection(input, context, 'progress');
}

function mistakeAnalysis(input = '', context = {}) {
  return buildReflection(input, context, 'mistake');
}

function thinkingPatternAnalysis(input = '', context = {}) {
  const clean = guards.sanitizeInput(input);
  const patterns = [];
  if (/semangat di awal|konsisten|menunda|prokrastin/i.test(clean)) patterns.push('Ada pola energi awal tinggi tetapi sistem kebiasaan belum cukup ringan.');
  if (/bingung|terlalu banyak|overwhelm/i.test(clean)) patterns.push('Ada kemungkinan cognitive overload karena terlalu banyak pilihan.');
  if (!patterns.length) patterns.push('Pola belum cukup jelas; perlu contoh berulang untuk menyimpulkan.');
  return patterns;
}

function buildReflection(input = '', context = {}, mode = 'general') {
  const clean = guards.sanitizeInput(input);
  const patterns = thinkingPatternAnalysis(clean, context);
  const confidence = clean.length > 40 ? 0.68 : 0.54;
  const text = [
    'Reflection',
    '',
    'Apa yang terjadi:',
    `- ${clean || 'Belum ada pengalaman/topik yang dijelaskan.'}`,
    '',
    'Apa yang terasa penting:',
    utils.bullet([
      mode === 'decision' ? 'Ada keputusan yang perlu dilihat dari risiko dan konsekuensi.' : '',
      mode === 'learning' ? 'Ada proses belajar yang perlu dibuat lebih kecil dan terukur.' : '',
      mode === 'progress' ? 'Progress perlu dilihat dari bukti kecil, bukan rasa sibuk.' : '',
      'Pisahkan fakta, perasaan, dan interpretasi sebelum menyimpulkan.'
    ]),
    '',
    'Asumsi yang mungkin muncul:',
    utils.bullet([
      'Aku harus menyelesaikan semuanya sekaligus.',
      'Kalau belum konsisten berarti aku tidak cocok.',
      'Solusi terbaik pasti yang paling lengkap.'
    ]),
    '',
    'Pola yang terlihat:',
    utils.bullet(patterns),
    '',
    'Pelajaran:',
    '- Progress lebih stabil jika langkahnya kecil, jelas, dan punya feedback cepat.',
    '',
    'Risiko/blind spot:',
    '- Terlalu keras menilai diri sendiri bisa mengaburkan masalah sistem/proses.',
    '- Fokus pada motivasi saja tanpa desain kebiasaan biasanya mudah runtuh.',
    '',
    'Langkah kecil berikutnya:',
    '- Pilih satu aksi 15 menit yang bisa dilakukan hari ini.',
    '',
    'Pertanyaan reflektif:',
    utils.bullet([
      'Apa satu hal yang sebenarnya sudah berjalan baik?',
      'Apa hambatan terkecil yang kalau dihapus akan membuat besok lebih mudah?',
      'Apa bukti bahwa kesimpulanku hari ini benar?'
    ]),
    '',
    `Confidence: ${utils.formatConfidence(confidence)}`
  ].join('\n');
  const note = /bunuh diri|self harm|melukai diri|putus asa berat/i.test(clean)
    ? 'Jika ini menyangkut dorongan menyakiti diri atau kondisi mental serius, hubungi orang tepercaya atau profesional kesehatan mental secepatnya.'
    : guards.buildSafetyNote(clean, confidence);
  return note ? `${text}\n\n${note}` : text;
}

function reflect(input = '', context = {}, services = {}) {
  return dailyReflection(input, context, services);
}

module.exports = {
  dailyReflection,
  decisionReflection,
  learningReflection,
  mistakeAnalysis,
  progressReflection,
  reflect,
  thinkingPatternAnalysis
};

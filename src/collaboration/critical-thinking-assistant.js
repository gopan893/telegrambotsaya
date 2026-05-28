'use strict';

const utils = require('./collaboration-utils');
const guards = require('./collaboration-guards');

function separateFactAssumptionOpinion(input = '', context = {}) {
  const clean = guards.sanitizeInput(input);
  const sentences = utils.splitSentences(clean, 8);
  const facts = utils.getContextFacts(context);
  const assumptions = [];
  const opinions = [];
  const inferences = [];
  const speculation = [];

  for (const sentence of sentences) {
    if (/(pasti|harus|terbaik|buruk|bagus|sukses)/i.test(sentence)) opinions.push(sentence);
    else if (/(karena|maka|jadi|berarti|akibatnya)/i.test(sentence)) inferences.push(sentence);
    else if (/(mungkin|sepertinya|bisa jadi|kemungkinan)/i.test(sentence)) speculation.push(sentence);
    else facts.push(sentence);
  }

  if (!assumptions.length) {
    assumptions.push('Konteks yang diberikan cukup untuk membuat analisis awal.');
    assumptions.push('Tujuan dan constraint user belum sepenuhnya eksplisit.');
  }

  return {
    facts: facts.slice(0, 6),
    assumptions: assumptions.slice(0, 5),
    opinions: opinions.slice(0, 5),
    inferences: inferences.slice(0, 5),
    speculation: speculation.slice(0, 5),
    evidenceNeeded: ['Data nyata/contoh kasus', 'Constraint waktu/biaya', 'Metrik sukses', 'Risiko yang tidak boleh terjadi'],
    confidence: facts.length > 1 ? 0.66 : 0.52
  };
}

function findBlindSpots(input = '', context = {}) {
  const clean = guards.sanitizeInput(input);
  const blindspots = [
    'Kebutuhan user nyata mungkin berbeda dari asumsi awal.',
    'Biaya maintenance bisa lebih besar daripada biaya implementasi.',
    'Fitur yang terlihat canggih belum tentu paling berdampak.',
    'Tidak adanya rollback plan bisa memperbesar risiko.'
  ];
  if (/roadmap|banyak fitur|semua/i.test(clean)) blindspots.unshift('Scope terlalu luas bisa membuat prioritas inti kabur.');
  if (/ai|autonomous|agent/i.test(clean)) blindspots.push('Autonomy tanpa guard bisa menjalankan tindakan yang tidak diinginkan.');
  if (context.activeWorkflows?.length > 3) blindspots.push('Terlalu banyak workflow aktif bisa membuat fokus pecah.');
  return blindspots.slice(0, 7);
}

function evaluateLogic(input = '') {
  const clean = guards.sanitizeInput(input);
  const issues = [];
  if (/(otomatis|pasti|selalu|semua)/i.test(clean)) issues.push('Ada kata absolut; cek apakah klaim ini benar di semua kondisi.');
  if (/(sukses|berhasil)/i.test(clean) && !/(metrik|ukur|data|user)/i.test(clean)) issues.push('Klaim sukses belum punya metrik/evidence.');
  if (!issues.length) issues.push('Logika awal cukup aman untuk eksplorasi, tetapi tetap perlu evidence.');
  return issues;
}

function comparePerspectives(input = '') {
  return [
    'Perspektif teknis: apakah solusi mudah dites, dipantau, dan dipulihkan?',
    'Perspektif user: apakah ini menyelesaikan kebutuhan nyata atau hanya menambah fitur?',
    'Perspektif biaya: apakah RAM, API call, dan waktu maintenance masih masuk akal?',
    'Perspektif risiko: apa hal terburuk yang bisa terjadi dan bagaimana rollback-nya?',
    'Perspektif jangka panjang: apakah keputusan ini membuat sistem lebih mudah berkembang?'
  ];
}

function generateCriticalQuestions(input = '') {
  return [
    'Apa bukti terkuat bahwa rencana ini benar?',
    'Apa bukti yang bisa membuat kita mengubah arah?',
    'Apa asumsi paling rapuh?',
    'Apa risiko yang belum punya mitigasi?',
    'Apa versi kecil yang bisa diuji dulu?'
  ];
}

function blindspots(input = '', context = {}) {
  return [
    'Blind Spot Analysis',
    '',
    'Asumsi tersembunyi:',
    utils.bullet(['Masalah yang terlihat sekarang adalah masalah paling penting.', 'Solusi yang lebih kompleks otomatis lebih baik.']),
    '',
    'Risiko yang mungkin terlewat:',
    utils.bullet(findBlindSpots(input, context)),
    '',
    'Hal yang perlu diverifikasi:',
    utils.bullet(['Kebutuhan user', 'Metrik sukses', 'Batas RAM/biaya', 'Rencana rollback']),
    '',
    'Skenario buruk:',
    '- Sistem makin kompleks tetapi tidak makin berguna.',
    '',
    'Pertanyaan kritis:',
    utils.bullet(generateCriticalQuestions(input))
  ].join('\n');
}

function assumptions(input = '', context = {}) {
  const separated = separateFactAssumptionOpinion(input, context);
  return [
    'Fact / Assumption / Opinion Check',
    '',
    'Fakta:',
    utils.bullet(separated.facts),
    '',
    'Asumsi:',
    utils.bullet(separated.assumptions),
    '',
    'Opini:',
    utils.bullet(separated.opinions),
    '',
    'Inferensi:',
    utils.bullet(separated.inferences),
    '',
    'Spekulasi:',
    utils.bullet(separated.speculation),
    '',
    'Evidence yang dibutuhkan:',
    utils.bullet(separated.evidenceNeeded),
    '',
    `Confidence: ${utils.formatConfidence(separated.confidence)}`
  ].join('\n');
}

function perspectives(input = '', context = {}) {
  return [
    'Multi-Perspective Analysis',
    '',
    utils.bullet(comparePerspectives(input, context)),
    '',
    'Sintesis:',
    '- Ambil keputusan dari gabungan dampak user, stabilitas teknis, biaya, risiko, dan efek jangka panjang.'
  ].join('\n');
}

module.exports = {
  assumptions,
  blindspots,
  comparePerspectives,
  evaluateLogic,
  findBlindSpots,
  generateCriticalQuestions,
  perspectives,
  separateFactAssumptionOpinion
};

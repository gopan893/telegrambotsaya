'use strict';

const utils = require('./collaboration-utils');

function createLearningPlan(topic = '', context = {}) {
  const clean = utils.sanitizeText(topic || 'topik ini', 180);
  const practical = context.user?.adaptive?.lastMode === 'coding' || /backend|node|kode|coding|database/i.test(clean);
  return {
    topic: clean,
    goal: `Memahami ${clean} sampai bisa menjelaskan, mempraktikkan, dan mengevaluasi hasil sendiri.`,
    prerequisites: practical
      ? ['Dasar command line', 'JavaScript dasar', 'HTTP dasar', 'Cara membaca error']
      : ['Istilah dasar', 'Contoh nyata', 'Kebiasaan mencatat pertanyaan'],
    roadmap: [
      `Tahap 1: pahami gambaran besar ${clean}.`,
      'Tahap 2: pelajari konsep inti satu per satu.',
      'Tahap 3: buat latihan kecil yang bisa dites.',
      'Tahap 4: catat error, pola salah, dan pertanyaan.',
      'Tahap 5: buat mini project atau studi kasus.',
      'Tahap 6: review, jelaskan ulang, lalu naik level.'
    ],
    coreConcepts: practical
      ? ['Request/response', 'Data model', 'Auth', 'Error handling', 'Testing', 'Deployment']
      : ['Definisi inti', 'Contoh', 'Pola', 'Anti-pola', 'Cara mengevaluasi pemahaman'],
    exercises: [
      'Jelaskan konsep dengan bahasa sendiri.',
      'Buat contoh kecil.',
      'Cari satu edge case.',
      'Minta kuis singkat dan koreksi jawaban.',
      'Ajarkan balik ke AI dalam 5 kalimat.'
    ],
    progressMetric: 'Kamu bisa menerapkan konsep tanpa menebak, menjelaskan trade-off, dan memperbaiki error dasar.',
    reflectiveQuestions: generateCriticalQuestions(clean, context),
    nextStep: 'Mulai dari satu konsep inti, lalu buat latihan 20-30 menit.'
  };
}

function explainConcept(topic = '') {
  const clean = utils.sanitizeText(topic || 'konsep ini', 180);
  return [
    `${clean} sebaiknya dipelajari dari gambaran besar dulu.`,
    'Cari: apa masalah yang diselesaikan, kapan dipakai, kapan tidak cocok, dan contoh kecilnya.'
  ];
}

function detectKnowledgeGaps(topic = '') {
  const clean = utils.sanitizeText(topic, 300).toLowerCase();
  const gaps = ['Definisi konsep inti', 'Contoh nyata', 'Cara mengukur pemahaman'];
  if (/backend|node|api/i.test(clean)) gaps.push('HTTP, database, auth, error handling, deployment');
  if (/database|postgres|redis/i.test(clean)) gaps.push('Perbedaan persistent storage, cache, index, dan query pattern');
  return [...new Set(gaps)].slice(0, 6);
}

function generatePracticePlan(topic = '') {
  return [
    `Buat catatan 1 halaman tentang ${utils.compactText(topic, 80)}.`,
    'Buat satu latihan kecil.',
    'Tambahkan satu edge case.',
    'Review hasil dan tulis apa yang masih membingungkan.'
  ];
}

function generateCriticalQuestions(topic = '') {
  return [
    `Apa bagian dari ${utils.compactText(topic, 80)} yang paling sering membuat pemula salah paham?`,
    'Apa contoh paling kecil yang membuktikan aku paham?',
    'Apa indikator bahwa aku hanya hafal, bukan mengerti?'
  ];
}

function format(plan = {}) {
  return [
    'Learning Mentor',
    '',
    'Tujuan belajar:',
    `- ${plan.goal || plan.topic || '-'}`,
    '',
    'Prasyarat:',
    utils.bullet(plan.prerequisites),
    '',
    'Roadmap bertahap:',
    utils.bullet(plan.roadmap),
    '',
    'Konsep inti:',
    utils.bullet(plan.coreConcepts),
    '',
    'Latihan:',
    utils.bullet(plan.exercises),
    '',
    'Cara mengukur progress:',
    `- ${plan.progressMetric || '-'}`,
    '',
    'Pertanyaan reflektif:',
    utils.bullet(plan.reflectiveQuestions),
    '',
    'Next step:',
    `- ${plan.nextStep || 'Mulai dari latihan kecil.'}`
  ].join('\n');
}

function buildLearningPlan(topic = '', context = {}, services = {}) {
  return createLearningPlan(topic, context, services);
}

module.exports = {
  buildLearningPlan,
  createLearningPlan,
  detectKnowledgeGaps,
  explainConcept,
  format,
  generateCriticalQuestions,
  generatePracticePlan
};

'use strict';

function buildLearningPlan(topic = '') {
  const clean = String(topic || 'topik ini').trim();
  return {
    topic: clean,
    prerequisites: ['Dasar istilah', 'Contoh nyata', 'Latihan kecil'],
    roadmap: [
      `Hari 1-3: pahami konsep inti ${clean}.`,
      'Hari 4-7: buat latihan kecil dan catat error.',
      'Minggu 2: bangun mini project.',
      'Minggu 3: tambah testing dan dokumentasi.',
      'Minggu 4: evaluasi, refactor, dan deploy.'
    ],
    coreConcepts: ['Mental model', 'Praktik kecil', 'Feedback loop', 'Evaluasi progress'],
    exercises: ['Jelaskan ulang dengan kata sendiri', 'Buat contoh', 'Cari 1 edge case', 'Ajarkan balik ke AI'],
    progressMetric: 'Kamu bisa menjelaskan konsep, menerapkan, dan memperbaiki error tanpa menebak.'
  };
}

function format(plan) {
  return [
    `Tujuan belajar: ${plan.topic}`,
    '',
    'Prasyarat:',
    plan.prerequisites.map(x => `- ${x}`).join('\n'),
    '',
    'Roadmap:',
    plan.roadmap.map(x => `- ${x}`).join('\n'),
    '',
    'Konsep inti:',
    plan.coreConcepts.map(x => `- ${x}`).join('\n'),
    '',
    'Latihan:',
    plan.exercises.map(x => `- ${x}`).join('\n'),
    '',
    `Cara ukur progress: ${plan.progressMetric}`,
    'Next step: mulai dari satu konsep inti dan minta kuis singkat.'
  ].join('\n');
}

module.exports = {
  buildLearningPlan,
  format
};

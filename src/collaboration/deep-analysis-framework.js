'use strict';

function bullet(items) {
  return items.filter(Boolean).map(item => `- ${item}`).join('\n') || '- belum cukup data';
}

function analyzeProblem(text = '') {
  const topic = String(text || '').trim();
  return {
    topic,
    knownFacts: [
      `Masalah/tujuan yang disebut: ${topic}`,
      'Keputusan akhir tetap perlu validasi user.'
    ],
    assumptions: [
      'Informasi yang diberikan belum lengkap.',
      'Solusi terbaik bergantung pada constraint waktu, biaya, risiko, dan skill.'
    ],
    risks: [
      'Salah memilih prioritas bisa membuat energi habis di hal yang kurang berdampak.',
      'Jika evidence kurang, kesimpulan bisa terlalu percaya diri.'
    ],
    nextQuestions: [
      'Apa hasil akhir yang paling penting?',
      'Constraint apa yang tidak boleh dilanggar?',
      'Apa tanda bahwa solusi ini berhasil?'
    ],
    bullet
  };
}

module.exports = {
  analyzeProblem,
  bullet
};

'use strict';

function buildMentalModel(topic = '') {
  const clean = String(topic || 'masalah ini').trim();
  return {
    topic: clean,
    models: [
      'First principles: pisahkan fakta dasar dari asumsi.',
      'Systems thinking: cari hubungan sebab-akibat dan feedback loop.',
      'Inversion: tanyakan bagaimana solusi ini bisa gagal.',
      'Probabilistic thinking: gunakan confidence, bukan kepastian palsu.',
      'Trade-off reasoning: setiap pilihan punya biaya.'
    ],
    questions: [
      'Apa yang benar-benar diketahui?',
      'Apa asumsi paling rapuh?',
      'Apa risiko jika salah?',
      'Apa eksperimen terkecil untuk menguji ini?'
    ]
  };
}

function format(model) {
  return [
    `Mental model untuk: ${model.topic}`,
    '',
    'Model berpikir:',
    model.models.map(item => `- ${item}`).join('\n'),
    '',
    'Pertanyaan kritis:',
    model.questions.map(item => `- ${item}`).join('\n')
  ].join('\n');
}

module.exports = {
  buildMentalModel,
  format
};

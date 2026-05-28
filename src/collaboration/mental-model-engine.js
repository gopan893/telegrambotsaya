'use strict';

const utils = require('./collaboration-utils');

const MODEL_LIBRARY = {
  first_principles: {
    name: 'First principles thinking',
    why: 'Cocok saat masalah terlihat rumit dan perlu dipisahkan antara fakta dasar dan asumsi.',
    apply: 'Tulis fakta yang benar-benar diketahui, buang jargon, lalu bangun solusi dari dasar.',
    risk: 'Bisa terlalu lambat jika semua hal dibongkar dari nol.'
  },
  systems: {
    name: 'Systems thinking',
    why: 'Cocok untuk masalah yang punya banyak bagian saling memengaruhi.',
    apply: 'Cari input, proses, output, feedback loop, dan bottleneck.',
    risk: 'Bisa membuat analisis melebar jika tidak dibatasi.'
  },
  probabilistic: {
    name: 'Probabilistic thinking',
    why: 'Cocok saat data belum lengkap dan kamu perlu berpikir dengan confidence, bukan kepastian.',
    apply: 'Beri estimasi confidence, cari bukti yang bisa menaikkan/menurunkan confidence.',
    risk: 'Angka confidence bisa terasa objektif padahal masih estimasi.'
  },
  inversion: {
    name: 'Inversion thinking',
    why: 'Cocok untuk menemukan risiko dan blind spot.',
    apply: 'Tanya: bagaimana rencana ini bisa gagal? Apa yang harus dihindari?',
    risk: 'Bisa membuat terlalu defensif jika tidak diimbangi next action.'
  },
  causal: {
    name: 'Causal reasoning',
    why: 'Cocok saat kamu perlu membedakan penyebab, gejala, dan korelasi.',
    apply: 'Tulis dugaan penyebab, bukti, dan cara menguji penyebab itu.',
    risk: 'Rawan salah kalau bukti terlalu sedikit.'
  },
  long_term: {
    name: 'Long-term reasoning',
    why: 'Cocok untuk keputusan yang efeknya terasa berminggu-minggu atau berbulan-bulan.',
    apply: 'Lihat dampak 1 minggu, 1 bulan, dan 6 bulan.',
    risk: 'Bisa mengabaikan langkah kecil hari ini.'
  },
  tradeoff: {
    name: 'Trade-off reasoning',
    why: 'Cocok untuk pilihan yang sama-sama punya biaya.',
    apply: 'Bandingkan manfaat, biaya, risiko, reversibility, dan opportunity cost.',
    risk: 'Bisa macet jika semua opsi terlihat seimbang.'
  },
  evidence: {
    name: 'Evidence-based reasoning',
    why: 'Cocok saat klaim perlu divalidasi.',
    apply: 'Pisahkan fakta, inferensi, opini, lalu cari bukti terkuat dan bukti pembatal.',
    risk: 'Bisa lambat jika evidence sulit didapat.'
  },
  perspectives: {
    name: 'Multi-perspective analysis',
    why: 'Cocok saat keputusan berdampak ke user, engineer, biaya, dan risiko.',
    apply: 'Lihat masalah dari beberapa sudut sebelum memilih arah.',
    risk: 'Bisa terlalu luas kalau tidak ditutup dengan next action.'
  }
};

function selectMentalModels(input = '', context = {}) {
  const text = utils.sanitizeText(input, 1200).toLowerCase();
  const selected = [];
  if (/dasar|rumit|bingung|mulai/i.test(text)) selected.push('first_principles');
  if (/sistem|bot|arsitektur|workflow|produk|user/i.test(text)) selected.push('systems');
  if (/mungkin|confidence|belum yakin|risiko/i.test(text)) selected.push('probabilistic');
  if (/gagal|blind|risiko|salah/i.test(text)) selected.push('inversion');
  if (/kenapa|penyebab|akibat/i.test(text)) selected.push('causal');
  if (/jangka panjang|roadmap|goal|karier/i.test(text)) selected.push('long_term');
  if (/pilih|atau|trade|opsi|database/i.test(text)) selected.push('tradeoff');
  if (/fakta|evidence|sumber|riset/i.test(text)) selected.push('evidence');
  if (/user|biaya|teknis|perspektif/i.test(text) || context.activeGoals?.length) selected.push('perspectives');
  return [...new Set(selected.length ? selected : ['first_principles', 'systems', 'tradeoff'])].slice(0, 4);
}

function explainMentalModel(modelKey, input = '', context = {}) {
  const model = MODEL_LIBRARY[modelKey] || MODEL_LIBRARY.first_principles;
  return {
    key: modelKey,
    ...model,
    example: `Untuk "${utils.compactText(input, 100)}", gunakan model ini untuk memisahkan apa yang diketahui, apa yang diasumsikan, dan apa next action terkecil.`
  };
}

function applyMentalModel(input = '', context = {}) {
  const models = selectMentalModels(input, context).map(key => explainMentalModel(key, input, context));
  return {
    topic: utils.sanitizeText(input || 'masalah ini', 180),
    models,
    deeperQuestions: [
      'Apa fakta dasar yang tidak berubah?',
      'Apa asumsi paling rapuh?',
      'Bagaimana keputusan ini bisa gagal?',
      'Apa bukti kecil yang bisa menguji arah ini?'
    ]
  };
}

function buildMentalModel(input = '', context = {}, services = {}) {
  return applyMentalModel(input, context, services);
}

function format(result = {}) {
  return [
    'Mental Model Builder',
    '',
    `Topik: ${result.topic || '-'}`,
    '',
    'Mental model yang cocok:',
    utils.bullet((result.models || []).map(model => `${model.name}: ${model.why}`)),
    '',
    'Cara menerapkan:',
    utils.bullet((result.models || []).map(model => model.apply)),
    '',
    'Contoh pada masalah kamu:',
    utils.bullet((result.models || []).map(model => model.example)),
    '',
    'Risiko salah pakai:',
    utils.bullet((result.models || []).map(model => `${model.name}: ${model.risk}`)),
    '',
    'Pertanyaan untuk memperdalam:',
    utils.bullet(result.deeperQuestions)
  ].join('\n');
}

module.exports = {
  applyMentalModel,
  buildMentalModel,
  explainMentalModel,
  format,
  selectMentalModels
};

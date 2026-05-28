'use strict';

const guards = require('./guards');

function splitSignals(text) {
  const clean = guards.sanitizeText(text, 2400);
  const sentences = clean.split(/[.!?\n]+/).map((item) => item.trim()).filter(Boolean).slice(0, 12);
  return sentences.length ? sentences : clean ? [clean] : [];
}

function identifyRisks(text) {
  const lower = guards.sanitizeText(text, 2400).toLowerCase();
  const risks = [];
  if (/(cepat|segera|langsung|otomatis|autonomous)/i.test(lower)) risks.push('Kecepatan/autonomy bisa membuat validasi terlewat jika guard tidak ketat.');
  if (/(deploy|production|render|server|api|token)/i.test(lower)) risks.push('Ada risiko operasional: konfigurasi, quota API, secret, dan restart server.');
  if (/(memory|memori|belajar|learning)/i.test(lower)) risks.push('Memory bisa tercemar noise jika tidak ada pruning, deduplication, dan confidence tracking.');
  if (/(research|riset|sumber|fakta)/i.test(lower)) risks.push('Jawaban bisa lemah jika evidence tidak diverifikasi atau sumber tidak dicatat.');
  if (!risks.length) risks.push('Risiko utama belum eksplisit; validasi asumsi dan batasan sebelum eksekusi.');
  return risks.slice(0, 5);
}

function identifyAssumptions(text) {
  const lower = guards.sanitizeText(text, 2400).toLowerCase();
  const assumptions = [];
  if (/(roadmap|tujuan|goal|belajar)/i.test(lower)) assumptions.push('Tujuan user cukup jelas untuk dipecah menjadi langkah bertahap.');
  if (/(bot|sistem|kode|fitur|module)/i.test(lower)) assumptions.push('Sistem lama tetap menjadi sumber kompatibilitas utama.');
  if (/(research|riset|validasi)/i.test(lower)) assumptions.push('Informasi yang butuh fakta terbaru harus divalidasi dengan sumber eksternal bila tersedia.');
  if (!assumptions.length) assumptions.push('Konteks yang tersedia cukup untuk memberi arahan awal, tetapi detail bisa berubah setelah klarifikasi.');
  return assumptions.slice(0, 5);
}

function analyzeTradeOff(problem) {
  const lower = guards.sanitizeText(problem, 2400).toLowerCase();
  const tradeOffs = [];
  if (/(autonomous|otomatis|agent|workflow)/i.test(lower)) {
    tradeOffs.push('Autonomy tinggi mempercepat eksekusi, tetapi perlu permission, confidence threshold, dan audit agar aman.');
  }
  if (/(memory|knowledge graph|graph|memori)/i.test(lower)) {
    tradeOffs.push('Memory panjang memberi kontinuitas, tetapi harus dibatasi agar RAM dan token tetap hemat.');
  }
  if (/(research|riset|fakta|sumber)/i.test(lower)) {
    tradeOffs.push('Riset mendalam meningkatkan akurasi, tetapi menambah latensi dan biaya API.');
  }
  if (!tradeOffs.length) {
    tradeOffs.push('Solusi sederhana lebih cepat dan stabil; solusi kompleks lebih adaptif tetapi butuh observability dan guard.');
  }
  return tradeOffs;
}

function separateFactInferenceSpeculation(text, context = {}) {
  const facts = [];
  const inferences = [];
  const speculation = [];

  if (context.activeGoals?.length) facts.push(`Ada ${context.activeGoals.length} goal aktif.`);
  if (context.activeWorkflows?.length) facts.push(`Ada ${context.activeWorkflows.length} workflow aktif.`);
  if (context.memorySummary && context.memorySummary !== '-') facts.push('Ada memory relevan yang bisa dipakai sebagai konteks.');

  for (const sentence of splitSignals(text).slice(0, 6)) {
    if (/(mungkin|kemungkinan|bisa jadi|sepertinya)/i.test(sentence)) speculation.push(sentence);
    else if (/(karena|berarti|maka|jadi|akibatnya)/i.test(sentence)) inferences.push(sentence);
    else facts.push(sentence);
  }

  return {
    facts: facts.slice(0, 6),
    inferences: inferences.slice(0, 5),
    speculation: speculation.slice(0, 4)
  };
}

function identifySystemicConsequences(text) {
  const lower = guards.sanitizeText(text, 2400).toLowerCase();
  const consequences = [];
  if (/(module|arsitektur|architecture|refactor)/i.test(lower)) consequences.push('Perubahan arsitektur memengaruhi maintainability, testing, dan onboarding pengembangan berikutnya.');
  if (/(workflow|goal|roadmap)/i.test(lower)) consequences.push('Workflow persistent membantu kontinuitas multi-hari, tetapi membutuhkan cleanup stale item.');
  if (/(memory|graph|context)/i.test(lower)) consequences.push('Context yang lebih kaya meningkatkan relevansi, tetapi rawan overload jika semua data dimasukkan ke prompt.');
  if (!consequences.length) consequences.push('Dampak sistemik perlu dilihat dari biaya, risiko, waktu, dan reversibility keputusan.');
  return consequences;
}

function evaluateEvidenceQuality(text, context = {}) {
  let score = 0.45;
  const evidenceSignals = [];
  if (context.graph?.edges?.length) {
    score += 0.1;
    evidenceSignals.push('Knowledge graph punya relasi pendukung.');
  }
  if (context.memories?.length) {
    score += 0.08;
    evidenceSignals.push('Ada memory relevan.');
  }
  if (/(sumber|evidence|data|dokumen|file|riset|berdasarkan)/i.test(text)) {
    score += 0.08;
    evidenceSignals.push('User meminta/menyebut evidence.');
  }
  if (!evidenceSignals.length) evidenceSignals.push('Evidence eksplisit masih terbatas.');
  return {
    score: guards.clamp01(score, 0.45),
    summary: evidenceSignals
  };
}

function buildOptions(text) {
  const lower = guards.sanitizeText(text, 2400).toLowerCase();
  const options = [];
  options.push({
    name: 'Mulai kecil dan iteratif',
    benefit: 'Cepat divalidasi dan risiko rendah.',
    cost: 'Cakupan awal lebih terbatas.'
  });
  if (/(arsitektur|sistem|workflow|project|bot|kode)/i.test(lower)) {
    options.push({
      name: 'Bangun fondasi modular',
      benefit: 'Lebih mudah dirawat untuk jangka panjang.',
      cost: 'Butuh disiplin testing dan dokumentasi.'
    });
  }
  if (/(riset|evidence|fakta|keputusan)/i.test(lower)) {
    options.push({
      name: 'Validasi berbasis evidence',
      benefit: 'Mengurangi hallucination dan keputusan lemah.',
      cost: 'Lebih lambat dan perlu sumber.'
    });
  }
  return options.slice(0, 4);
}

function buildMentalModel(text) {
  if (/(goal|workflow|roadmap|tujuan)/i.test(text)) {
    return 'Pikirkan sistem sebagai rantai: goal menentukan arah, workflow mengubah arah menjadi langkah, memory menjaga konteks, graph menghubungkan konsep, reflection memperbaiki keputusan.';
  }
  if (/(research|riset|evidence)/i.test(text)) {
    return 'Pikirkan riset sebagai peta bukti: sumber memberi fakta, confidence menilai kekuatan bukti, graph menghubungkan evidence ke keputusan.';
  }
  return 'Pikirkan masalah sebagai sistem: input, constraint, opsi, trade-off, risiko, feedback, lalu next action terkecil.';
}

function recommendNextSteps(text, context = {}) {
  const steps = [];
  if (context.activeGoals?.length) steps.push('Pilih satu goal aktif sebagai fokus utama agar workflow tidak tersebar.');
  if (context.activeWorkflows?.length) steps.push('Review workflow aktif dan tandai step yang sudah selesai.');
  if (/(belajar|roadmap|goal)/i.test(text)) steps.push('Ubah tujuan besar menjadi milestone mingguan dan daily action kecil.');
  if (/(bug|error|crash|deploy)/i.test(text)) steps.push('Prioritaskan reproduksi error, log, fix kecil, lalu verifikasi.');
  if (!steps.length) steps.push('Tentukan outcome yang diinginkan, batasan, opsi, risiko, lalu next action paling kecil.');
  return [...new Set(steps)].slice(0, 5);
}

function produceConfidenceLevel(text, context = {}) {
  let score = 0.55;
  if (context.memorySummary && context.memorySummary !== '-') score += 0.1;
  if (context.activeGoals?.length) score += 0.07;
  if (text.length > 80) score += 0.05;
  if (/(mungkin|kurang jelas|tidak tahu|belum pasti)/i.test(text)) score -= 0.12;
  return guards.clamp01(score, 0.55);
}

function analyzeGoal(goalOrText, context = {}) {
  const text = typeof goalOrText === 'string'
    ? goalOrText
    : `${goalOrText?.title || ''}. ${goalOrText?.description || ''}`;
  const separated = separateFactInferenceSpeculation(text, context);
  const evidenceQuality = evaluateEvidenceQuality(text, context);
  const options = buildOptions(text);
  const nextActions = recommendNextSteps(text, context);
  const confidence = produceConfidenceLevel(text, context);
  return {
    problemSummary: guards.compactText(text || 'Masalah belum dijelaskan.', 260),
    goal: typeof goalOrText === 'string'
      ? inferGoalFromText(text)
      : guards.compactText(goalOrText?.title || text, 180),
    facts: separated.facts,
    knownFacts: separated.facts,
    assumptions: identifyAssumptions(text),
    inferences: separated.inferences,
    speculation: separated.speculation,
    risks: identifyRisks(text),
    tradeOffs: analyzeTradeOff(text),
    options,
    recommendation: chooseRecommendation(options, nextActions, confidence),
    nextActions,
    confidence,
    evidenceQuality,
    systemicConsequences: identifySystemicConsequences(text),
    mentalModel: buildMentalModel(text)
  };
}

function formatStrategicAnalysis(analysis) {
  return [
    'Analisis Strategis',
    `Confidence: ${(analysis.confidence || 0).toFixed(2)}`,
    `Evidence quality: ${(analysis.evidenceQuality?.score || 0).toFixed(2)}`,
    '',
    'Ringkasan masalah:',
    `- ${analysis.problemSummary || '-'}`,
    '',
    'Tujuan:',
    `- ${analysis.goal || '-'}`,
    '',
    'Fakta:',
    ...(analysis.knownFacts || analysis.facts || ['-']).map((item) => `- ${item}`),
    '',
    'Asumsi:',
    ...(analysis.assumptions || ['-']).map((item) => `- ${item}`),
    '',
    'Inferensi:',
    ...(analysis.inferences?.length ? analysis.inferences : ['-']).map((item) => `- ${item}`),
    '',
    'Spekulasi:',
    ...(analysis.speculation?.length ? analysis.speculation : ['-']).map((item) => `- ${item}`),
    '',
    'Trade-off:',
    ...(analysis.tradeOffs || ['-']).map((item) => `- ${item}`),
    '',
    'Risiko:',
    ...(analysis.risks || ['-']).map((item) => `- ${item}`),
    '',
    'Opsi:',
    ...(analysis.options || []).map((item) => `- ${item.name}: ${item.benefit} Trade-off: ${item.cost}`),
    '',
    'Rekomendasi:',
    `- ${analysis.recommendation || '-'}`,
    '',
    'Next action:',
    ...(analysis.nextActions || ['-']).map((item) => `- ${item}`),
    '',
    'Mental model:',
    `- ${analysis.mentalModel || '-'}`
  ].join('\n');
}

function inferGoalFromText(text) {
  const clean = guards.compactText(text, 180);
  if (/(belajar|roadmap|menguasai)/i.test(clean)) return 'Membangun roadmap belajar yang realistis.';
  if (/(deploy|production|stabil)/i.test(clean)) return 'Meningkatkan stabilitas dan kesiapan produksi.';
  if (/(keputusan|pilih|opsi)/i.test(clean)) return 'Membuat keputusan dengan trade-off yang jelas.';
  return clean || 'Menentukan arah dan next action yang paling masuk akal.';
}

function chooseRecommendation(options = [], nextActions = [], confidence = 0.5) {
  const prefix = confidence < 0.56
    ? 'Rekomendasi sementara: '
    : 'Rekomendasi: ';
  const option = options[0]?.name || 'mulai dari langkah kecil';
  const action = nextActions[0] || 'klarifikasi outcome yang diinginkan.';
  return `${prefix}${option}, lalu ${action}`;
}

module.exports = {
  analyzeGoal,
  analyzeTradeOff,
  identifyAssumptions,
  identifyRisks,
  identifySystemicConsequences,
  evaluateEvidenceQuality,
  recommendNextSteps,
  produceConfidenceLevel,
  separateFactInferenceSpeculation,
  formatStrategicAnalysis
};

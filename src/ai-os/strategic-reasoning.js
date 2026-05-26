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
  return {
    facts: separateFactInferenceSpeculation(text, context).facts,
    assumptions: identifyAssumptions(text),
    inferences: separateFactInferenceSpeculation(text, context).inferences,
    risks: identifyRisks(text),
    tradeOffs: analyzeTradeOff(text),
    nextActions: recommendNextSteps(text, context),
    confidence: produceConfidenceLevel(text, context),
    systemicConsequences: identifySystemicConsequences(text)
  };
}

function formatStrategicAnalysis(analysis) {
  return [
    'Analisis Strategis',
    `Confidence: ${(analysis.confidence || 0).toFixed(2)}`,
    '',
    'Fakta:',
    ...(analysis.facts || ['-']).map((item) => `- ${item}`),
    '',
    'Asumsi:',
    ...(analysis.assumptions || ['-']).map((item) => `- ${item}`),
    '',
    'Trade-off:',
    ...(analysis.tradeOffs || ['-']).map((item) => `- ${item}`),
    '',
    'Risiko:',
    ...(analysis.risks || ['-']).map((item) => `- ${item}`),
    '',
    'Next action:',
    ...(analysis.nextActions || ['-']).map((item) => `- ${item}`)
  ].join('\n');
}

module.exports = {
  analyzeGoal,
  analyzeTradeOff,
  identifyAssumptions,
  identifyRisks,
  identifySystemicConsequences,
  recommendNextSteps,
  produceConfidenceLevel,
  separateFactInferenceSpeculation,
  formatStrategicAnalysis
};

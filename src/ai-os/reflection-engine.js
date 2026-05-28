'use strict';

const guards = require('./guards');
const memoryBus = require('./memory-bus');

function evaluateAnswerQuality(question = '', answer = '') {
  const q = guards.sanitizeText(question, 1200);
  const a = guards.sanitizeText(answer, 3000);
  let quality = 0.55;
  let clarity = 0.55;
  let risk = 0.25;

  if (a.length > 80) quality += 0.1;
  if (a.includes('\n') || /(\d+\.|- )/.test(a)) clarity += 0.08;
  if (/(karena|trade-off|risiko|asumsi|confidence|contoh)/i.test(a)) quality += 0.12;
  if (q && guards.textRelevance(q, a) > 0.25) quality += 0.1;
  if (/(tidak yakin|belum pasti|perlu verifikasi)/i.test(a)) risk -= 0.05;
  if (/(pasti|selalu|dijamin|100%)/i.test(a)) risk += 0.15;
  if (a.length < 30) quality -= 0.2;

  return {
    answerQuality: guards.clamp01(quality),
    clarity: guards.clamp01(clarity),
    risk: guards.clamp01(risk),
    confidence: guards.clamp01((quality + clarity + (1 - risk)) / 3)
  };
}

function detectWeakReasoning(answer = '') {
  const a = guards.sanitizeText(answer, 3000).toLowerCase();
  const issues = [];
  if (a.length < 60) issues.push('Jawaban sangat pendek; mungkin kurang menjelaskan alasan.');
  if (!/(karena|sebab|alasannya|trade-off|risiko|asumsi|contoh)/i.test(a)) issues.push('Alasan dan trade-off belum terlihat eksplisit.');
  if (/(pasti|selalu|tidak mungkin)/i.test(a) && !/(kecuali|tergantung|dengan asumsi)/i.test(a)) issues.push('Ada klaim absolut tanpa batasan.');
  return issues;
}

function detectWeakAssumptions(question = '', answer = '') {
  const combined = guards.sanitizeText(`${question} ${answer}`, 3000).toLowerCase();
  const assumptions = [];
  if (/(tentu|pasti|selalu|semua orang)/i.test(combined)) assumptions.push('Ada klaim umum/absolut yang perlu dibatasi.');
  if (/(mudah|cepat|langsung)/i.test(combined) && !/(syarat|tergantung|asumsi|jika)/i.test(combined)) assumptions.push('Asumsi kemudahan belum dijelaskan syaratnya.');
  if (/(berdasarkan|evidence|sumber)/i.test(combined) && !/(http|file:|sumber|dokumen|data)/i.test(combined)) assumptions.push('Klaim berbasis evidence belum punya rujukan jelas.');
  return assumptions;
}

function detectRisks(question = '', answer = '') {
  const combined = guards.sanitizeText(`${question} ${answer}`, 3000).toLowerCase();
  const risks = [];
  if (/(hapus|reset|deploy|push|token|password|calendar|bayar)/i.test(combined)) risks.push('Ada potensi aksi sensitif; butuh permission dan/atau konfirmasi.');
  if (/(medical|hukum|financial|keuangan|diagnosis)/i.test(combined)) risks.push('Topik high-stakes; perlu verifikasi dan batasan.');
  if (/(pasti|dijamin|100%)/i.test(combined)) risks.push('Risiko overconfidence karena klaim terlalu pasti.');
  return risks;
}

function extractInsight(question = '', answer = '') {
  const combined = guards.sanitizeText(`${question} ${answer}`, 2600);
  if (!combined) return null;
  const sentences = combined.split(/[.!?\n]+/).map((item) => item.trim()).filter(Boolean);
  const candidate = sentences.find((item) => /(penting|karena|risiko|trade-off|belajar|goal|workflow|memory|arsitektur)/i.test(item)) || sentences[0];
  return guards.compactText(candidate, 360);
}

function storeReflectionMemory(userId, reflection = {}, botServices) {
  const state = guards.ensureAIOSState(userId, botServices);
  const entry = {
    id: guards.stableId('reflect', `${userId}:${reflection.question || ''}`),
    userId: guards.normalizeUserId(userId),
    question: guards.sanitizeText(reflection.question || '', 700),
    insight: guards.sanitizeText(reflection.insight || '', 700),
    quality: guards.clamp01(reflection.quality, 0.6),
    confidence: guards.clamp01(reflection.confidence, 0.6),
    risks: guards.safeArray(reflection.risks).slice(0, 5),
    weakAssumptions: guards.safeArray(reflection.weakAssumptions).slice(0, 5),
    createdAt: guards.nowIso()
  };
  if (entry.insight) state.reflections.push(entry);
  state.reflections = guards.pruneListByScore(state.reflections, guards.DEFAULT_LIMITS.reflections, (item) => {
    return (item.quality || 0.5) + (item.confidence || 0.5) * 0.3 + (Date.parse(item.createdAt || 0) || 0) / Date.now() * 0.1;
  });
  if (entry.insight) {
    memoryBus.publish(userId, {
      type: 'reflective',
      content: entry.insight,
      tags: ['reflection'],
      source: 'reflection-engine',
      confidence: entry.confidence,
      importance: 0.68
    }, botServices);
    memoryBus.publishInsight(userId, entry.insight, botServices, {
      source: 'reflection-engine',
      confidence: entry.confidence,
      importance: 0.7,
      tags: ['reflection', 'insight']
    });
  }
  guards.touchState(state);
  guards.persistAsync(botServices);
  return { ok: true, reflection: entry };
}

function suggestImprovement(evaluation = {}, weakReasoning = []) {
  const suggestions = [];
  if ((evaluation.answerQuality || 0) < 0.65) suggestions.push('Tambahkan alasan utama dan batasan jawaban.');
  if ((evaluation.clarity || 0) < 0.65) suggestions.push('Rapikan menjadi poin singkat atau langkah praktis.');
  if ((evaluation.risk || 0) > 0.5) suggestions.push('Turunkan klaim absolut dan tambahkan confidence atau kebutuhan verifikasi.');
  if (weakReasoning.length) suggestions.push('Perkuat reasoning: asumsi, trade-off, risiko, dan contoh.');
  return suggestions.slice(0, 4);
}

function detectContradiction(text = '', memories = []) {
  const lower = guards.sanitizeText(text, 1200).toLowerCase();
  if (!/(bukan|tidak lagi|sebenarnya|koreksi|salah)/i.test(lower)) return [];
  return guards.safeArray(memories)
    .filter((memory) => guards.textRelevance(lower, memory.content || memory.text || '') > 0.35)
    .slice(0, 5);
}

function detectLowConfidence(evaluation = {}) {
  return guards.clamp01(evaluation.confidence, 0.5) < 0.55 || guards.clamp01(evaluation.answerQuality, 0.5) < 0.5;
}

function reflect(userId, question, answer, botServices) {
  const evaluation = evaluateAnswerQuality(question, answer);
  const weakReasoning = detectWeakReasoning(answer);
  const weakAssumptions = detectWeakAssumptions(question, answer);
  const risks = detectRisks(question, answer);
  const insight = extractInsight(question, answer);
  const result = storeReflectionMemory(userId, {
    question,
    insight,
    quality: evaluation.answerQuality,
    confidence: evaluation.confidence,
    risks: [...weakReasoning, ...risks],
    weakAssumptions
  }, botServices);
  return {
    evaluation,
    weakReasoning,
    weakAssumptions,
    risks,
    insight,
    suggestions: suggestImprovement(evaluation, [...weakReasoning, ...weakAssumptions, ...risks]),
    stored: result.ok
  };
}

module.exports = {
  evaluateAnswerQuality,
  detectWeakReasoning,
  detectWeakAssumptions,
  detectRisks,
  extractInsight,
  storeReflectionMemory,
  suggestImprovement,
  detectContradiction,
  detectLowConfidence,
  reflect
};

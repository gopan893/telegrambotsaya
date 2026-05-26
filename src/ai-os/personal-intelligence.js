'use strict';

const guards = require('./guards');
const unifiedMemory = require('./unified-memory');

function getProfile(userId, botServices) {
  const state = guards.ensureAIOSState(userId, botServices);
  const memories = unifiedMemory.searchMemory(userId, '', { limit: 30 }, botServices);
  const learningSignals = memories.filter((memory) => /belajar|mentor|jelaskan|step|contoh/i.test(memory.content));
  const projectSignals = memories.filter((memory) => /project|proyek|bot|kode|github|render/i.test(memory.content));
  const correctionSignals = memories.filter((memory) => memory.type === 'correction' || /koreksi|sebenarnya|salah/i.test(memory.content));

  return {
    userId: guards.normalizeUserId(userId),
    learningStyle: inferLearningStyle(learningSignals),
    activeProjectHints: projectSignals.slice(0, 5).map((memory) => guards.compactText(memory.content, 120)),
    correctionThemes: correctionSignals.slice(0, 5).map((memory) => guards.compactText(memory.content, 120)),
    confidence: state.memories.length >= 5 ? 0.72 : 0.48,
    basis: 'Hanya memakai memory yang tersimpan; tidak membuat profil baru tanpa bukti.'
  };
}

function inferLearningStyle(memories = []) {
  const text = memories.map((memory) => memory.content).join(' ').toLowerCase();
  if (!text) return 'belum cukup data';
  if (/(detail|step|langkah|kenapa|reasoning)/i.test(text)) return 'suka penjelasan bertahap dan alasan keputusan';
  if (/(ringkas|langsung|fokus|kode)/i.test(text)) return 'suka jawaban praktis dan langsung';
  return 'campuran: butuh jawaban jelas dengan contoh singkat';
}

function buildPersonalPrompt(userId, botServices) {
  const profile = getProfile(userId, botServices);
  return [
    '[PERSONAL INTELLIGENCE]',
    `Learning style: ${profile.learningStyle}`,
    `Confidence: ${profile.confidence.toFixed(2)}`,
    'Project hints:',
    ...(profile.activeProjectHints.length ? profile.activeProjectHints.map((item) => `- ${item}`) : ['-']),
    'Correction themes:',
    ...(profile.correctionThemes.length ? profile.correctionThemes.map((item) => `- ${item}`) : ['-']),
    'Aturan: jangan mengarang profil user; hanya gunakan sinyal di atas.'
  ].join('\n');
}

module.exports = {
  getProfile,
  inferLearningStyle,
  buildPersonalPrompt
};

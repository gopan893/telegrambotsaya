'use strict';

const store = require('./lifeos-store');
const utils = require('./lifeos-utils');

async function createEnergyMoodNote(input = {}, services = {}) {
  if (utils.containsSecretLike(input)) return { ok: false, reason: 'SECRET_LIKE_MOOD_NOTE_REJECTED', status: 400 };
  const text = input.note || input.description || input.text || input.title || '';
  const crisis = utils.detectCrisisText(text);
  const type = input.type === 'energy_note' ? 'energy_note' : 'mood_note';
  const item = utils.buildLifeItem({
    ...input,
    type,
    title: input.title || (type === 'energy_note' ? 'Energy note' : 'Mood note'),
    description: crisis ? 'Sensitive crisis-related note redacted from shared summary.' : text,
    sensitivity: 'private',
    data: {
      energyLevel: Number(input.energyLevel || input.energy || 0) || null,
      mood: utils.sanitizeText(input.mood || '', 80),
      crisisFlag: crisis,
      ...(input.data || {})
    }
  }, services);
  await store.upsertLifeItem(item, services);
  await utils.auditLife('lifeos/mood_energy_note_created', { workspaceId: item.workspaceId, userId: item.userId, targetId: item.id, summary: { type, private: true, crisisFlag: crisis } }, services);
  return {
    ok: true,
    note: item,
    supportiveMessage: crisis
      ? 'Aku tidak akan mendiagnosis. Kalau kamu merasa berisiko menyakiti diri, segera hubungi orang tepercaya atau layanan darurat setempat sekarang.'
      : 'Dicatat secara privat. Ambil satu langkah kecil dan beri ruang istirahat tanpa menyalahkan diri.'
  };
}

async function summarizeEnergyTrend(range = {}, services = {}) {
  const notes = await store.listLifeItems({ workspaceId: services.workspaceId, userId: services.userId, limit: 200 }, services);
  const energyNotes = notes.filter((item) => ['energy_note', 'mood_note'].includes(item.type));
  const levels = energyNotes.map((item) => Number(item.data?.energyLevel || 0)).filter(Boolean);
  return {
    ok: true,
    totalNotes: energyNotes.length,
    averageEnergy: levels.length ? Math.round(levels.reduce((a, b) => a + b, 0) / levels.length) : null,
    private: true
  };
}

function detectBurnoutWarningSigns(notes = [], services = {}) {
  const raw = Array.isArray(notes) ? notes : [];
  const lowEnergy = raw.filter((item) => Number(item.data?.energyLevel || item.energyLevel || 0) > 0 && Number(item.data?.energyLevel || item.energyLevel || 0) <= 2).length;
  const stressText = raw.filter((item) => /capek|lelah|burnout|stres|stress|overload/i.test(`${item.title || ''} ${item.description || ''} ${item.note || ''}`)).length;
  return {
    warning: lowEnergy >= 3 || stressText >= 3,
    lowEnergy,
    stressText,
    note: 'Ini bukan diagnosis medis; gunakan sebagai sinyal untuk mengurangi beban dan mencari bantuan jika perlu.'
  };
}

async function suggestGentleRecoveryPlan(services = {}) {
  return {
    ok: true,
    plan: [
      'Kurangi target hari ini menjadi satu tugas kecil.',
      'Ambil jeda singkat, makan/minum, dan rapikan satu hal yang mudah.',
      'Tunda keputusan besar kalau energi sedang rendah.',
      'Hubungi orang tepercaya jika terasa berat.'
    ],
    medicalDisclaimer: 'Ini dukungan umum, bukan diagnosis atau terapi.'
  };
}

module.exports = {
  createEnergyMoodNote,
  detectBurnoutWarningSigns,
  suggestGentleRecoveryPlan,
  summarizeEnergyTrend
};

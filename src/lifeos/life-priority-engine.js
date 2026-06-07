'use strict';

const store = require('./lifeos-store');
const focusManager = require('./focus-session-manager');
const energyJournal = require('./energy-mood-journal');

async function recommendTodayPriority(services = {}) {
  const tasks = await store.listLifeItems({ workspaceId: services.workspaceId, userId: services.userId, type: 'personal_task', limit: 100 }, services);
  const active = tasks.filter((item) => !['done', 'archived'].includes(item.status));
  const sorted = active.sort((a, b) => priorityRank(b.priority) - priorityRank(a.priority));
  const top = sorted[0] || null;
  return {
    ok: true,
    priority: top,
    recommendation: top ? `Mulai dari: ${top.title}` : 'Buat satu task kecil yang realistis untuk hari ini.'
  };
}

async function recommendLifeProjectBalance(services = {}) {
  const mood = await energyJournal.summarizeEnergyTrend({}, services);
  const lowEnergy = mood.averageEnergy !== null && mood.averageEnergy <= 2;
  return {
    ok: true,
    balance: lowEnergy ? 'rest_first' : 'balanced_push',
    recommendation: lowEnergy
      ? 'Energi sedang rendah; kecilkan scope dan pilih satu langkah ringan.'
      : 'Ambil satu task project dan satu task personal, jangan buka terlalu banyak front.',
    moodSummary: mood
  };
}

async function detectTooManyCommitments(services = {}) {
  const items = await store.listLifeItems({ workspaceId: services.workspaceId, userId: services.userId, limit: 300 }, services);
  const active = items.filter((item) => !['done', 'archived', 'completed'].includes(item.status));
  return {
    ok: true,
    overloaded: active.length > 12,
    activeCount: active.length,
    recommendation: active.length > 12 ? 'Kurangi daftar hari ini ke 3 prioritas dan arsipkan/tunda sisanya.' : 'Beban terlihat masih masuk akal.'
  };
}

async function suggestSimplifiedPlan(services = {}) {
  const priority = await recommendTodayPriority(services);
  const focus = await focusManager.suggestFocusBlock(services);
  return {
    ok: true,
    plan: [
      priority.priority ? priority.priority.title : 'Tulis satu task paling penting.',
      `Focus block ${focus.durationMinutes} menit.`,
      'Satu habit kecil.',
      'Review singkat malam hari.'
    ]
  };
}

async function decideRestOrPush(input = {}, services = {}) {
  const text = `${input.text || ''} ${input.mood || ''}`.toLowerCase();
  if (/capek|lelah|burnout|sakit|stres|stress/.test(text)) {
    return { ok: true, decision: 'rest', reason: 'energy signal is low', suggestion: 'Istirahat dulu, lalu pilih tugas kecil 10 menit.' };
  }
  return { ok: true, decision: 'push_gently', reason: 'no overload signal detected', suggestion: 'Kerjakan satu focus block kecil, lalu cek ulang energi.' };
}

function priorityRank(value = 'medium') {
  return { low: 1, medium: 2, high: 3, critical: 4 }[value] || 2;
}

module.exports = {
  decideRestOrPush,
  detectTooManyCommitments,
  recommendLifeProjectBalance,
  recommendTodayPriority,
  suggestSimplifiedPlan
};

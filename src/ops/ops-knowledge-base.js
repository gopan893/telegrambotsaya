'use strict';

const store = require('./ops-store');
const guards = require('./ops-guards');

const fixRecipes = {
  model_issue: [
    'Cek env provider di Render.',
    'Cek rate limit dan status provider.',
    'Pastikan fallback provider aktif.',
    'Coba request pendek untuk memverifikasi koneksi.'
  ],
  infra_issue: [
    'Cek RAM RSS dan heap.',
    'Prune telemetry/cache.',
    'Kurangi context dan benchmark otomatis.',
    'Restart manual jika memory tidak turun.'
  ],
  workflow_issue: [
    'Cek queue aktif/pending.',
    'Kurangi concurrency atau aktifkan fallback simple mode.',
    'Cari task yang timeout.',
    'Hindari menjalankan workflow sensitif otomatis.'
  ],
  cost_issue: [
    'Gunakan compressed context.',
    'Kurangi maxTokens untuk mode biasa.',
    'Gunakan cache untuk pertanyaan berulang.',
    'Jalankan benchmark hanya manual atau jarang.'
  ]
};

function addOpsLesson(lesson, services = {}) {
  const state = store.getOpsState(services);
  const item = {
    id: `lesson_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: guards.nowIso(),
    title: guards.sanitizeText(lesson.title || 'Operational lesson', 120),
    content: guards.sanitizeText(lesson.content || lesson, 500),
    tags: (lesson.tags || []).slice(0, 8).map(tag => guards.sanitizeText(tag, 60))
  };
  store.appendBounded(state.opsLessons, item, state.config.maxLessons);
  store.saveOpsState(services);
  return item;
}

function searchOpsKnowledge(query = '', services = {}) {
  const state = store.getOpsState(services);
  const q = String(query || '').toLowerCase();
  const lessons = (state.opsLessons || []).filter(item => {
    const hay = `${item.title} ${item.content} ${(item.tags || []).join(' ')}`.toLowerCase();
    return !q || hay.includes(q);
  }).slice(-10).reverse();
  return lessons;
}

function getFixRecipe(type = 'infra_issue') {
  return fixRecipes[type] || [
    'Kumpulkan health, telemetry, dan incident terbaru.',
    'Lakukan recovery non-destruktif lebih dulu.',
    'Buat rollback plan jika regresi terdeteksi.',
    'Catat lesson setelah masalah selesai.'
  ];
}

function getDeploymentChecklist() {
  return [
    'node --check telebot.js sukses.',
    'npm run check sukses.',
    'Env Telegram dan AI provider tersedia di Render.',
    '.env tidak ikut dipush.',
    'Jalankan /health setelah deploy.',
    'Jalankan /benchmark jika ada perubahan besar.',
    'Pantau /incidents 10-15 menit pertama.'
  ];
}

function getRollbackChecklist() {
  return [
    'Identifikasi commit terakhir yang dicurigai.',
    'Simpan incident dan telemetry ringkas.',
    'Rollback manual tanpa force push kecuali benar-benar diminta.',
    'Redeploy dan jalankan /health.',
    'Jalankan /benchmark untuk validasi.'
  ];
}

module.exports = {
  addOpsLesson,
  searchOpsKnowledge,
  getFixRecipe,
  getDeploymentChecklist,
  getRollbackChecklist
};

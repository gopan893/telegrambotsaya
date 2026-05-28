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

const defaultKnowledge = [
  {
    title: 'Render free tier memory limit awareness',
    content: 'Render free tier rawan OOM jika RSS mendekati 512MB. Pantau /health, prune telemetry, dan batasi context.',
    tags: ['render', 'memory', 'infra']
  },
  {
    title: 'Webhook troubleshooting',
    content: 'Jika webhook tidak menerima update, cek WEBHOOK_URL/TELEGRAM_WEBHOOK_URL, setWebhook log, dan path /webhook/<token>.',
    tags: ['webhook', 'telegram', 'deploy']
  },
  {
    title: 'Redis unavailable fallback',
    content: 'Jika Redis gagal, bot fallback ke JSON. Ini aman untuk skala kecil, tetapi perlu pruning dan atomic write.',
    tags: ['redis', 'storage', 'fallback']
  },
  {
    title: 'AI provider rate limit handling',
    content: 'Rate limit provider ditangani dengan circuit breaker dan fallback provider. Kurangi AI call dan gunakan cache.',
    tags: ['provider', 'rate-limit', 'ai']
  },
  {
    title: 'Telegram API failure handling',
    content: 'Jika sendMessage gagal, bot retry tanpa reply_to/parse_mode. Pantau tool errors dan latency Telegram.',
    tags: ['telegram', 'tool', 'api']
  },
  {
    title: 'High latency checklist',
    content: 'Cek latency p90, provider response, queue pressure, token size, dan deep reasoning yang tidak perlu.',
    tags: ['latency', 'performance']
  },
  {
    title: 'Memory bloat checklist',
    content: 'Cek memory count, graph size, telemetry size, stale workflow, dan prune item low-importance.',
    tags: ['memory', 'pruning']
  },
  {
    title: 'Benchmark regression checklist',
    content: 'Bandingkan latest vs baseline, lihat metric turun, cek commit terakhir, lalu pilih tuning sebelum rollback.',
    tags: ['benchmark', 'regression']
  },
  {
    title: 'Safe rollback checklist',
    content: 'Rollback hanya jika ada evidence regresi kuat. Hindari force push. Validasi ulang dengan /health dan /benchmark.',
    tags: ['rollback', 'safety']
  }
];

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
  const all = [
    ...defaultKnowledge.map((item, index) => ({
      id: `default_${index + 1}`,
      createdAt: null,
      ...item
    })),
    ...(state.opsLessons || [])
  ];
  const lessons = all.filter(item => {
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

function getPostmortemTemplate() {
  return [
    'Ringkasan incident:',
    'Dampak:',
    'Root cause sementara:',
    'Evidence:',
    'Mitigasi:',
    'Recovery yang dijalankan:',
    'Pencegahan ulang:',
    'Owner dan follow-up:'
  ];
}

function getOperationalSummary(services = {}) {
  const state = store.getOpsState(services);
  return {
    knownFailurePatterns: defaultKnowledge.filter(item => item.tags.includes('infra') || item.tags.includes('api')).length,
    customLessons: (state.opsLessons || []).length,
    tuningHistory: (state.tuningHistory || []).slice(-5),
    benchmarkHistory: (state.benchmarkRuns || []).slice(-5),
    infraConstraints: defaultKnowledge.filter(item => item.tags.includes('render') || item.tags.includes('memory')),
    postmortemTemplate: getPostmortemTemplate()
  };
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
  getRollbackChecklist,
  getPostmortemTemplate,
  getOperationalSummary
};

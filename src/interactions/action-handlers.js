'use strict';

const interactionState = require('./interaction-state');
const keyboardBuilder = require('./keyboard-builder');
const guards = require('./interaction-guards');

function getQueryContext(query = {}) {
  return {
    userId: String(query.from?.id || ''),
    chatId: query.message?.chat?.id,
    messageId: query.message?.message_id
  };
}

function replyExtra(ctx) {
  return ctx.messageId ? { reply_to_message_id: ctx.messageId } : {};
}

async function sendText(services, ctx, text, extra = {}) {
  if (typeof services.sendTelegramMessage === 'function') {
    return services.sendTelegramMessage(ctx.chatId, text, { ...replyExtra(ctx), ...extra });
  }
  if (typeof services.sendChunkedMessage === 'function') {
    await services.sendChunkedMessage(ctx.chatId, text, { ...replyExtra(ctx), ...extra });
    return true;
  }
  if (typeof services.safeSendMessage === 'function') {
    return services.safeSendMessage(ctx.chatId, text, { ...replyExtra(ctx), ...extra });
  }
  return false;
}

function getLastContext(state) {
  const topic = state?.userText || state?.topic || 'topik sebelumnya';
  const answer = state?.answerText || '';
  return { topic, answer };
}

async function askActionAI(services, ctx, prompt, intent = 'interactive_action') {
  const systemPrompt = typeof services.getSystemPrompt === 'function'
    ? services.getSystemPrompt(ctx.userId)
    : 'Kamu adalah assistant Telegram yang membantu secara ringkas, jelas, dan praktis.';

  if (typeof services.getSmartAnswer === 'function') {
    return services.getSmartAnswer(prompt, ctx.userId, systemPrompt, intent);
  }

  if (typeof services.askAI === 'function') {
    return services.askAI(systemPrompt, prompt, {
      userId: ctx.userId,
      question: prompt,
      intent,
      allowSearch: true,
      temperature: 0.45,
      maxTokens: 900
    });
  }

  return 'Maaf, AI belum tersedia untuk aksi ini.';
}

async function getRequiredState(services, ctx) {
  const state = await interactionState.getInteraction(ctx.userId);
  if (!state) {
    await sendText(
      services,
      ctx,
      'Konteks tombol ini sudah kedaluwarsa. Coba kirim pertanyaannya lagi ya.'
    );
    return null;
  }
  return state;
}

async function handleSummarize(services, query) {
  const ctx = getQueryContext(query);
  const state = await getRequiredState(services, ctx);
  if (!state) return true;
  const { topic, answer } = getLastContext(state);
  const prompt = `Ringkas jawaban berikut agar nyaman dibaca di Telegram mobile.

Topik user:
${topic}

Jawaban sebelumnya:
${answer}

Berikan ringkasan inti, poin penting, dan next step jika relevan.`;
  const result = await askActionAI(services, ctx, prompt, 'interactive_summary');
  await sendText(services, ctx, result);
  return true;
}

async function handleExplainMore(services, query) {
  const ctx = getQueryContext(query);
  const state = await getRequiredState(services, ctx);
  if (!state) return true;
  const { topic, answer } = getLastContext(state);
  const prompt = `Jelaskan lebih lanjut secara natural dan mudah dipahami.

Topik user:
${topic}

Jawaban sebelumnya:
${answer}

Tambahkan contoh praktis, risiko, dan kapan pendekatan ini cocok.`;
  const result = await askActionAI(services, ctx, prompt, 'interactive_explain_more');
  await sendText(services, ctx, result);
  return true;
}

async function handleMakeRoadmap(services, query) {
  const ctx = getQueryContext(query);
  const state = await getRequiredState(services, ctx);
  if (!state) return true;
  const topic = state.userText || state.topic || 'topik ini';
  const prompt = `Buat roadmap praktis untuk topik berikut:
${topic}

Format:
- tujuan
- tahap 1 sampai 4
- latihan
- cara ukur progress
- next action hari ini

Buat ringkas dan cocok untuk Telegram.`;
  const result = await askActionAI(services, ctx, prompt, 'interactive_roadmap');
  await sendText(services, ctx, result);
  return true;
}

async function handleSaveMemory(services, query) {
  const ctx = getQueryContext(query);
  const state = await getRequiredState(services, ctx);
  if (!state) return true;

  if (typeof services.ensureUser === 'function') {
    const user = services.ensureUser(ctx.userId);
    const memoryLine = guards.compact(
      `Insight dari percakapan: ${state.userText || ''} -> ${state.answerText || ''}`,
      700
    );
    user.summary = [user.summary, memoryLine].filter(Boolean).join('\n').slice(-2500);
    if (typeof services.persist === 'function') await services.persist();
  }

  await sendText(services, ctx, 'Sudah saya simpan sebagai memory ringkas.');
  return true;
}

async function handleCodingAction(services, query, action) {
  const ctx = getQueryContext(query);
  const state = await getRequiredState(services, ctx);
  if (!state) return true;

  const topic = state.userText || 'kebutuhan coding tadi';
  const actionMap = {
    make: 'buat implementasi kode production-ready',
    code: 'buat implementasi kode production-ready',
    debug: 'bantu debug dan cari akar masalah',
    error: 'jelaskan error, penyebab, dan solusinya',
    structure: 'buat struktur folder yang scalable',
    folder: 'buat struktur folder yang scalable',
    jwt: 'gunakan JWT',
    nextauth: 'gunakan NextAuth',
    session: 'gunakan session-based auth',
    supabase: 'gunakan Supabase Auth'
  };
  const selected = actionMap[action] || 'bantu secara teknis';
  const prompt = `Konteks coding user:
${topic}

Pilihan user dari tombol: ${selected}

Berikan jawaban coding yang praktis:
- asumsi singkat
- langkah implementasi
- kode inti jika diperlukan
- edge case
- cara test manual`;
  const result = await askActionAI(services, ctx, prompt, 'interactive_coding');
  await sendText(services, ctx, result);
  return true;
}

async function handleLearningAction(services, query, action) {
  const ctx = getQueryContext(query);
  const state = await getRequiredState(services, ctx);
  if (!state) return true;

  const topic = state.userText || 'materi tadi';
  const actionMap = {
    roadmap: 'buat roadmap belajar',
    simple: 'jelaskan dengan bahasa lebih sederhana',
    exercise: 'beri latihan bertahap',
    quiz: 'buat quiz singkat'
  };
  const prompt = `Topik belajar:
${topic}

Pilihan user: ${actionMap[action] || 'lanjutkan pembelajaran'}.

Jawab sebagai mentor yang ringkas, jelas, dan actionable.`;
  const result = await askActionAI(services, ctx, prompt, 'interactive_learning');
  await sendText(services, ctx, result);
  return true;
}

async function handleDecisionAction(services, query, action) {
  const ctx = getQueryContext(query);
  const state = await getRequiredState(services, ctx);
  if (!state) return true;

  const topic = state.userText || 'keputusan tadi';
  const actionMap = {
    compare: 'bandingkan opsi',
    risk: 'lihat risiko',
    recommend: 'beri rekomendasi dengan catatan confidence',
    next: 'buat next step',
    perf: 'analisis dari sisi performa',
    cost: 'analisis dari sisi biaya',
    usecase: 'analisis berdasarkan use case'
  };
  const prompt = `Masalah keputusan:
${topic}

Fokus analisis: ${actionMap[action] || 'decision support'}.

Format:
- frame keputusan
- opsi
- trade-off
- risiko
- rekomendasi
- next step
- confidence

Ingat: keputusan akhir tetap di user.`;
  const result = await askActionAI(services, ctx, prompt, 'interactive_decision');
  await sendText(services, ctx, result);
  return true;
}

async function handleOpsAction(services, query, action) {
  const ctx = getQueryContext(query);

  if (!services.opsSystem || typeof services.getOpsServices !== 'function') {
    await sendText(services, ctx, 'AI Operations belum tersedia di runtime ini.');
    return true;
  }

  const opsServices = services.getOpsServices();
  if (action === 'health') {
    const health = services.opsSystem.healthMonitor.getHealth(opsServices);
    await sendText(services, ctx, `Health: ${health.status}\nUptime: ${health.uptimeSeconds}s\nMemory: ${health.memory?.rssMb || 0} MB\nError terbaru: ${health.recentErrorCount || 0}`);
    return true;
  }

  if (action === 'diag') {
    const diagnosis = services.opsSystem.diagnosticsEngine.diagnose(opsServices);
    await sendText(services, ctx, `Diagnostics: ${diagnosis.severity}\nKategori: ${diagnosis.category}\nPenyebab: ${diagnosis.suspectedCause}\nSaran: ${diagnosis.recommendedFixes?.join('; ') || diagnosis.safeNextAction}\nConfidence: ${diagnosis.confidence}`);
    return true;
  }

  if (action === 'errors') {
    const summary = services.opsSystem.telemetry.getTelemetrySummary(opsServices);
    await sendText(services, ctx, `Error terbaru: ${summary.recentErrorCount || 0}\nRequest: ${summary.counters?.request || 0}\nAI call: ${summary.counters?.aiCall || 0}`);
    return true;
  }

  if (action === 'recovery') {
    const recovery = services.opsSystem.recoveryController.getRecoveryRecommendation(opsServices);
    const recommended = recovery.plan?.recommendedAction || {};
    await sendText(services, ctx, `Recovery plan:\nAksi: ${recommended.action || 'keep_monitoring'}\nRisiko: ${recommended.riskLevel || 'low'}\nDampak: ${recommended.expectedImpact || 'Lanjut monitoring.'}\nCatatan: ${recovery.plan?.requiresAdminConfirmation ? 'butuh konfirmasi admin' : 'aman sebagai rekomendasi'}`);
    return true;
  }

  await sendText(services, ctx, 'Aksi ops tidak dikenal.');
  return true;
}

async function handleWellnessAction(services, query, action) {
  const ctx = getQueryContext(query);
  const state = await getRequiredState(services, ctx);
  if (!state) return true;

  const topic = state.userText || 'topik kesehatan atau kebiasaan tadi';
  const actionMap = {
    safe: 'beri tips aman dan batasan yang perlu diperhatikan',
    plan7d: 'buat rencana 7 hari yang realistis dan tidak ekstrem',
    help: 'jelaskan kapan perlu bantuan profesional atau pemeriksaan lebih lanjut'
  };
  const prompt = `Konteks user:
${topic}

Fokus tombol: ${actionMap[action] || 'bantu secara aman dan empatik'}.

Jawab dengan empati, ringkas, dan aman:
- inti jawaban
- langkah aman
- tanda bahaya atau kapan perlu bantuan
- next step kecil

Jangan diagnosis pasti dan jangan mengaku sebagai dokter.`;
  const result = await askActionAI(services, ctx, prompt, 'interactive_wellness');
  await sendText(services, ctx, result);
  return true;
}

async function handleProductAction(services, query, action) {
  const ctx = getQueryContext(query);
  const state = await getRequiredState(services, ctx);
  if (!state) return true;
  const topic = state.userText || 'produk tadi';
  const actionMap = {
    compare: 'bandingkan dengan alternatif populer',
    price: 'jelaskan kisaran harga dan faktor value for money',
    recommend: 'beri rekomendasi beli dengan pro kontra',
    sum: 'ringkas spesifikasi dan nilai utamanya'
  };
  const prompt = `Topik produk:
${topic}

Pilihan user: ${actionMap[action] || 'bantu analisis produk'}.

Jawab ringkas, jelas, dan beri catatan jika info harga/spesifikasi bisa berubah.`;
  const result = await askActionAI(services, ctx, prompt, 'interactive_product');
  await sendText(services, ctx, result);
  return true;
}

module.exports = {
  handleCodingAction,
  handleDecisionAction,
  handleExplainMore,
  handleLearningAction,
  handleMakeRoadmap,
  handleOpsAction,
  handleProductAction,
  handleSaveMemory,
  handleSummarize,
  handleWellnessAction
};

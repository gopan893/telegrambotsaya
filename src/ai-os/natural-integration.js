'use strict';

const contextSync = require('./context-sync');
const utils = require('./aios-utils');
const contextRelevanceGate = require('./context-relevance-gate');

const TRIGGER_PATTERNS = [
  /langkah\s+berikut/i,
  /next\s+action/i,
  /prioritas/i,
  /\bproject\b|\bproyek\b/i,
  /\bgoal\b|tujuan/i,
  /\bworkflow\b|alur\s+kerja/i,
  /lanjutkan/i,
  /\broadmap\b/i,
  /risiko|resiko/i,
  /\binsight\b/i,
  /\bmemory\b|\bmemori\b|ingat/i,
  /\bprogress\b|progres/i,
  /rencana/i,
  /strategi/i,
  /evaluasi/i,
  /\bphase\b|tahap/i,
  /apa\s+yang\s+harus\s+saya\s+kerjakan/i,
  /bot\s+saya\s+sehat|cek.*bot.*sehat|cek.*health|diagnos/i
];

const SIMPLE_GREETINGS = new Set([
  'halo',
  'hai',
  'hi',
  'hello',
  'pagi',
  'siang',
  'sore',
  'malam',
  'ok',
  'oke',
  'sip',
  'makasih',
  'terima kasih',
  'thanks'
]);

function normalizeText(text = '') {
  return String(text || '').trim().replace(/\s+/g, ' ');
}

function isSimpleGreeting(text = '') {
  return SIMPLE_GREETINGS.has(normalizeText(text).toLowerCase());
}

function isSimpleMath(text = '') {
  const clean = normalizeText(text);
  return /^[\d\s+\-*/().,%]+$/.test(clean) && /\d/.test(clean) && /[+\-*/%]/.test(clean);
}

function detectAIOSNaturalNeed(text = '', adaptiveResult = {}) {
  const clean = normalizeText(text);
  const lower = clean.toLowerCase();

  if (!clean || clean.startsWith('/')) {
    return { needed: false, reason: 'empty_or_command', confidence: 0 };
  }
  if (isSimpleGreeting(clean)) {
    return { needed: false, reason: 'simple_greeting', confidence: 0.05 };
  }
  if (isSimpleMath(clean)) {
    return { needed: false, reason: 'simple_math', confidence: 0.05 };
  }

  const matched = TRIGGER_PATTERNS.find(pattern => pattern.test(lower));
  if (matched) {
    return { needed: true, reason: 'keyword_trigger', confidence: 0.82 };
  }

  const mode = String(adaptiveResult?.mode || '').toLowerCase();
  if (['strategic', 'decision', 'reflection', 'research', 'ops'].includes(mode)) {
    return { needed: true, reason: `adaptive_${mode}`, confidence: 0.62 };
  }

  return { needed: false, reason: 'no_aios_trigger', confidence: 0.2 };
}

function shouldUseAIOSContext(text = '', adaptiveResult = {}) {
  return detectAIOSNaturalNeed(text, adaptiveResult).needed;
}

async function safeCall(fn, fallback) {
  try {
    return await fn();
  } catch (_) {
    return fallback;
  }
}

async function buildContextFromRepositories(userId, text, repositories = {}) {
  let [relevantMemory, activeGoals, workflows, recentInsights] = await Promise.all([
    repositories.memories?.searchMemories
      ? safeCall(() => repositories.memories.searchMemories(userId, text, { limit: 5 }), [])
      : [],
    repositories.goals?.listGoals
      ? safeCall(() => repositories.goals.listGoals(userId, { status: 'active', limit: 5 }), [])
      : [],
    repositories.workflows?.listWorkflows
      ? safeCall(() => repositories.workflows.listWorkflows(userId, { status: 'active', limit: 5 }), [])
      : [],
    repositories.insights?.listInsights
      ? safeCall(() => repositories.insights.listInsights(userId, { limit: 5 }), [])
      : []
  ]);

  try {
    relevantMemory = contextRelevanceGate.filterRelevantContext(text, relevantMemory);
    activeGoals = contextRelevanceGate.filterRelevantContext(text, activeGoals);
    workflows = contextRelevanceGate.filterRelevantContext(text, workflows);
    recentInsights = contextRelevanceGate.filterRelevantContext(text, recentInsights);
  } catch (_) {}

  const activeWorkflows = [];
  for (const workflow of workflows || []) {
    const steps = repositories.workflows?.listWorkflowSteps
      ? await safeCall(() => repositories.workflows.listWorkflowSteps(userId, workflow.id), [])
      : [];
    activeWorkflows.push({
      ...workflow,
      steps: steps.map(step => ({
        ...step,
        done: step.status === 'done',
        text: step.title || step.text
      }))
    });
  }

  return {
    userId: String(userId),
    relevantMemory,
    activeGoals,
    activeWorkflows,
    recentInsights,
    summaryText: formatSummaryText({ relevantMemory, activeGoals, activeWorkflows, recentInsights })
  };
}

async function buildNaturalAIOSContext(userId, text = '', services = {}) {
  const repositories = services.storageManager?.getRepositories?.();
  const postgresActive = Boolean(services.storageManager?.isPostgresEnabled?.());

  if (postgresActive && repositories) {
    return buildContextFromRepositories(userId, text, repositories);
  }

  if (services.aiOS?.contextSync?.buildAIOSContext) {
    return services.aiOS.contextSync.buildAIOSContext(userId, text, services);
  }

  return contextSync.buildAIOSContext(userId, text, services);
}

function contextHasUsefulData(context = {}) {
  return Boolean(
    context.relevantMemory?.length ||
    context.activeGoals?.length ||
    context.activeWorkflows?.length ||
    context.recentInsights?.length
  );
}

function getPendingStep(workflow = {}) {
  return (workflow.steps || []).find(step => !step.done && step.status !== 'done');
}

function formatProgress(progress) {
  const n = Number(progress || 0);
  if (!Number.isFinite(n)) return '0%';
  return `${Math.round(n <= 1 ? n * 100 : n)}%`;
}

function formatSummaryText(context = {}) {
  return [
    context.activeGoals?.length ? `Goals: ${context.activeGoals.map(goal => goal.title).join(', ')}` : '',
    context.activeWorkflows?.length ? `Workflows: ${context.activeWorkflows.map(workflow => workflow.title).join(', ')}` : '',
    context.relevantMemory?.length ? `Memory: ${context.relevantMemory.map(memory => utils.compactText(memory.content || memory.text || '', 80)).join(' | ')}` : '',
    context.recentInsights?.length ? `Insights: ${context.recentInsights.map(insight => utils.compactText(insight.content || insight.text || '', 80)).join(' | ')}` : ''
  ].filter(Boolean).join('\n');
}

function inferNaturalType(text = '') {
  const lower = normalizeText(text).toLowerCase();
  if (/bot.*sehat|cek.*health|diagnos|error|lambat|status bot/.test(lower)) return 'ops';
  if (/lanjutkan.*workflow|workflow terakhir|lanjut.*alur/.test(lower)) return 'continue_workflow';
  if (/prioritas|minggu ini|apa.*kerjakan/.test(lower)) return 'priority';
  if (/risiko|resiko|roadmap|strategi/.test(lower)) return 'risk';
  if (/insight|pelajaran penting|pola penting/.test(lower)) return 'insight';
  if (/langkah berikut|next action|setelah phase|setelah tahap/.test(lower)) return 'next_action';
  return 'context_answer';
}

function buildOpsAnswer(services = {}) {
  try {
    const ops = services.opsSystem;
    const opsServices = typeof services.getOpsServices === 'function' ? services.getOpsServices() : services;
    if (!ops?.healthMonitor?.getHealth) return null;
    const health = ops.healthMonitor.getHealth(opsServices);
    return [
      'Status bot saat ini:',
      '',
      `Health: ${health.status || 'unknown'}`,
      `Uptime: ${Math.floor((health.uptimeSeconds || 0) / 60)} menit`,
      health.memory ? `Memory: RSS ${health.memory.rssMb} MB, heap ${health.memory.heapUsedMb}/${health.memory.heapTotalMb} MB` : '',
      '',
      'Catatan:',
      '- Ini cek ringan dari runtime lokal bot.',
      '- Untuk kepastian setelah deploy, cek juga Render logs dan endpoint /health.'
    ].filter(Boolean).join('\n');
  } catch (_) {
    return [
      'Saya belum bisa membaca health module saat ini.',
      '',
      'Cek cepat yang bisa kamu lakukan:',
      '- Jalankan /health jika kamu admin.',
      '- Cek Render logs.',
      '- Pastikan env TELEGRAM_TOKEN dan API key AI aktif.'
    ].join('\n');
  }
}

function buildNaturalAnswer(text = '', context = {}, services = {}) {
  const type = inferNaturalType(text);
  const goals = (context.activeGoals || []).slice(0, 5);
  const workflows = (context.activeWorkflows || []).slice(0, 5);
  const memories = (context.relevantMemory || []).slice(0, 5);
  const insights = (context.recentInsights || []).slice(0, 5);
  const latestWorkflow = workflows[0];
  const nextStep = latestWorkflow ? getPendingStep(latestWorkflow) : null;

  if (type === 'ops') return buildOpsAnswer(services);

  if (type === 'continue_workflow' && latestWorkflow) {
    return [
      `Workflow terakhir yang aktif: ${latestWorkflow.title}`,
      '',
      latestWorkflow.description ? `Konteks: ${utils.compactText(latestWorkflow.description, 220)}` : '',
      `Status: ${latestWorkflow.status || 'active'}`,
      `Step: ${(latestWorkflow.steps || []).filter(step => step.done || step.status === 'done').length}/${(latestWorkflow.steps || []).length}`,
      '',
      `Langkah berikutnya: ${nextStep ? (nextStep.text || nextStep.title) : 'review hasil workflow dan tentukan step baru.'}`,
      '',
      'Next action:',
      '- Kerjakan satu step kecil dulu.',
      '- Setelah selesai, tandai dengan /workflowdone <workflowId> | <stepNumber>.'
    ].filter(Boolean).join('\n');
  }

  if (type === 'priority') {
    const items = [];
    if (workflows[0]) items.push(`Lanjutkan workflow: ${workflows[0].title}${nextStep ? ` -> ${nextStep.text || nextStep.title}` : ''}`);
    if (goals[0]) items.push(`Dorong goal utama: ${goals[0].title} (${goals[0].priority || 'medium'}, ${formatProgress(goals[0].progress)})`);
    if (insights[0]) items.push(`Gunakan insight: ${utils.compactText(insights[0].content || insights[0].text || '', 140)}`);
    if (memories[0]) items.push(`Jaga konteks project: ${utils.compactText(memories[0].content || memories[0].text || '', 140)}`);

    return [
      'Prioritas paling masuk akal minggu ini:',
      '',
      ...(items.length ? items.slice(0, 3).map((item, index) => `${index + 1}. ${item}`) : [
        '1. Pilih satu goal utama yang paling berdampak.',
        '2. Pecah jadi satu workflow kecil.',
        '3. Tentukan satu step yang bisa selesai hari ini.'
      ]),
      '',
      'Saran saya: jangan tambah fitur dulu sebelum satu jalur utama stabil.'
    ].join('\n');
  }

  if (type === 'risk') {
    return [
      'Risiko terbesar yang terlihat:',
      '',
      '1. Scope terlalu melebar',
      '   Banyak modul AI bisa membuat debugging dan deploy makin sulit.',
      '',
      '2. Kompleksitas storage/context',
      '   Memory, goal, workflow, dan graph harus tetap selective supaya tidak berat.',
      '',
      '3. Validasi produksi kurang rutin',
      '   Setelah banyak fitur, command lama dan fallback Render harus terus dites.',
      '',
      goals.length ? `Goal terkait: ${goals.map(goal => goal.title).join(', ')}` : '',
      workflows.length ? `Workflow terkait: ${workflows.map(workflow => workflow.title).join(', ')}` : '',
      '',
      'Next action: pilih satu risiko, buat checklist mitigasi, lalu uji di Render.'
    ].filter(Boolean).join('\n');
  }

  if (type === 'insight') {
    const lines = insights.length
      ? insights.map((insight, index) => `${index + 1}. ${utils.compactText(insight.content || insight.text || '', 180)}`)
      : memories.slice(0, 3).map((memory, index) => `${index + 1}. ${utils.compactText(memory.content || memory.text || '', 180)}`);
    return [
      'Insight penting dari konteks project:',
      '',
      ...(lines.length ? lines : ['1. Fokus terbesar sekarang adalah stabilitas, bukan menambah modul besar.']),
      '',
      'Pola yang terlihat:',
      '- Project ini bergerak dari bot command biasa menjadi sistem AI personal.',
      '- Risiko utamanya bukan ide, tapi menjaga routing, storage, dan deploy tetap sederhana.',
      '',
      'Next action: dokumentasikan satu keputusan teknis yang paling berdampak hari ini.'
    ].join('\n');
  }

  const actions = [];
  if (latestWorkflow && nextStep) actions.push(`Kerjakan step workflow "${latestWorkflow.title}": ${nextStep.text || nextStep.title}`);
  if (goals[0]) actions.push(`Review goal "${goals[0].title}" dan naikkan progress secara realistis.`);
  if (insights[0]) actions.push(`Gunakan insight: ${utils.compactText(insights[0].content || insights[0].text || '', 150)}`);

  return [
    'Langkah berikutnya yang paling masuk akal:',
    '',
    ...(actions.length ? actions.slice(0, 3).map((item, index) => `${index + 1}. ${item}`) : [
      '1. Tentukan satu output kecil yang bisa selesai hari ini.',
      '2. Jalankan test smoke.',
      '3. Catat blocker sebelum tambah fitur baru.'
    ]),
    '',
    goals.length ? `Goal aktif: ${goals.map(goal => `${goal.title} (${formatProgress(goal.progress)})`).join(', ')}` : '',
    workflows.length ? `Workflow aktif: ${workflows.map(workflow => workflow.title).join(', ')}` : '',
    memories.length ? `Memory relevan: ${utils.compactText(memories[0].content || memories[0].text || '', 180)}` : '',
    '',
    'Saya tetap sarankan keputusan akhirnya kamu ambil berdasarkan target minggu ini dan kondisi deploy terakhir.'
  ].filter(Boolean).join('\n');
}

async function answerWithAIOSContext(userId, chatId, text = '', msg = {}, services = {}) {
  const adaptiveResult = services.adaptiveDecision || services.adaptiveResult || {};
  const detection = detectAIOSNaturalNeed(text, adaptiveResult);
  if (!detection.needed) return { handled: false, reason: detection.reason };

  try {
    const type = inferNaturalType(text);
    if (type === 'ops') {
      const answer = buildOpsAnswer(services);
      if (!answer) return { handled: false, reason: 'ops_unavailable' };
      const send = services.sendChunkedMessage || services.safeSendMessage;
      if (typeof send === 'function') {
        await send(chatId, answer, { reply_to_message_id: msg.message_id });
      }
      return { handled: true, answer, context: null, reason: detection.reason, type };
    }

    const context = await buildNaturalAIOSContext(userId, text, services);

    if (!contextHasUsefulData(context)) {
      return { handled: false, reason: 'empty_aios_context' };
    }

    const answer = buildNaturalAnswer(text, context, services);
    if (!answer) return { handled: false, reason: 'empty_answer' };

    const send = services.sendChunkedMessage || services.safeSendMessage;
    if (typeof send === 'function') {
      await send(chatId, answer, { reply_to_message_id: msg.message_id });
    }

    return {
      handled: true,
      answer,
      context,
      reason: detection.reason,
      type
    };
  } catch (err) {
    services.log?.warn?.('AI OS natural integration fallback:', err.message);
    return { handled: false, reason: 'aios_natural_error', error: err.message };
  }
}

module.exports = {
  buildNaturalAIOSContext,
  detectAIOSNaturalNeed,
  shouldUseAIOSContext,
  answerWithAIOSContext,
  inferNaturalType,
  isSimpleGreeting,
  isSimpleMath
};

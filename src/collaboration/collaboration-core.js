'use strict';

const store = require('./collaboration-store');
const guards = require('./collaboration-guards');
const utils = require('./collaboration-utils');
const thinkingPartner = require('./thinking-partner');
const strategic = require('./strategic-thinking-engine');
const reflection = require('./reflection-system');
const critical = require('./critical-thinking-assistant');
const learning = require('./learning-intelligence');
const mentalModel = require('./mental-model-engine');
const decision = require('./decision-support');
const insightGenerator = require('./insight-generator');
const analytics = require('./collaboration-analytics');

async function handleCollaborationRequest(type, userId, input = '', services = {}, options = {}) {
  const clean = guards.sanitizeInput(input);
  const user = options.user || services.ensureUser?.(userId) || {};
  await store.hydrate(userId, user, services);

  const collab = store.ensureCollab(user);
  collab.analytics.sessions += 1;
  collab.recentMode = type;
  collab.updatedAt = utils.nowIso();

  const context = await buildCollaborationContext(userId, clean, services, { user, type });
  const result = await runCollaborationFlow(type, context, services);

  if (result.insight) {
    store.appendBounded(collab.insights, result.insight);
    await insightGenerator.saveInsightIfImportant(userId, result.insight, services);
  }
  if (type === 'decision') {
    collab.analytics.decisions += 1;
    store.appendBounded(collab.decisions, { text: clean, createdAt: utils.nowIso() });
  }
  if (type === 'reflection') collab.analytics.reflections += 1;
  if (type === 'learning') collab.analytics.learningPlans += 1;

  await store.mirror(userId, user, services);
  return guards.limitOutputSections(result.text || fallbackText(clean), 90);
}

async function buildCollaborationContext(userId, input = '', services = {}, options = {}) {
  const user = options.user || services.ensureUser?.(userId) || {};
  const context = {
    userId: String(userId),
    input,
    user,
    type: options.type || 'thinking',
    relevantMemory: [],
    activeGoals: [],
    activeWorkflows: [],
    recentInsights: [],
    graph: { nodes: [], edges: [] },
    summaryText: ''
  };

  try {
    const aiOS = services.aiOS || require('../ai-os');
    if (aiOS?.contextSync?.buildAIOSContext) {
      const aiosContext = await aiOS.contextSync.buildAIOSContext(userId, input, services);
      Object.assign(context, aiosContext);
    }
  } catch (err) {
    context.contextError = err.message;
  }

  return context;
}

async function runCollaborationFlow(type, context = {}, services = {}) {
  const input = context.input || '';
  const normalized = normalizeType(type);
  let text = '';
  let insight = null;

  if (normalized === 'thinking') {
    text = thinkingPartner.synthesizeThinking(input, context, services);
    insight = insightGenerator.createInsight(context.userId, `Thinking focus: ${utils.compactText(input, 180)}`, 'think-command', {
      confidence: 0.62,
      importance: 0.56
    });
  } else if (normalized === 'strategy') {
    const analysis = strategic.analyzeStrategy(input, context, services);
    text = strategic.format(analysis);
    insight = insightGenerator.createInsight(context.userId, analysis.recommendation, 'strategy-command', {
      type: 'strategic',
      confidence: analysis.confidence,
      importance: 0.74
    });
  } else if (normalized === 'reflection') {
    text = reflection.dailyReflection(input, context, services);
    insight = insightGenerator.createInsight(context.userId, `Reflection lesson: ${utils.compactText(input, 180)}`, 'reflection-command', {
      type: 'reflection',
      confidence: 0.64,
      importance: 0.62
    });
  } else if (normalized === 'learning') {
    const plan = learning.createLearningPlan(input, context, services);
    text = learning.format(plan);
    insight = insightGenerator.createInsight(context.userId, `Learning goal: ${plan.topic}`, 'learnplan-command', {
      type: 'learning',
      confidence: 0.68,
      importance: 0.66
    });
  } else if (normalized === 'mental_model') {
    text = mentalModel.format(mentalModel.applyMentalModel(input, context, services));
  } else if (normalized === 'decision') {
    text = decision.format(decision.analyzeDecision(input, context, services));
  } else if (normalized === 'blindspot') {
    text = critical.blindspots(input, context, services);
  } else if (normalized === 'assumptions') {
    text = critical.assumptions(input, context, services);
  } else if (normalized === 'perspectives') {
    text = critical.perspectives(input, context, services);
  } else if (normalized === 'insight') {
    const result = insightGenerator.formatInsightResponse(input, context, context.userId);
    text = result.text;
    insight = result.insight;
  } else if (normalized === 'status') {
    text = buildStatus(context.user || {}, context);
  } else {
    text = thinkingPartner.synthesizeThinking(input, context, services);
  }

  const note = guards.buildSafetyNote(input, 0.66);
  if (note && !text.includes(note)) text = `${text}\n\n${note}`;
  return { text, insight };
}

function buildStatus(user = {}, context = {}) {
  const collab = store.ensureCollab(user);
  const summary = analytics.summarize(collab);
  return [
    'Human-AI Collaboration',
    'Status: active',
    `Adaptive mode: ${user.adaptive?.enabled === false ? 'off' : 'on'}`,
    `Recent mode: ${collab.recentMode || '-'}`,
    `Memory relevan: ${context.relevantMemory?.length || 0}`,
    `Active goals: ${context.activeGoals?.length || 0}`,
    `Active workflows: ${context.activeWorkflows?.length || 0}`,
    `Insights: ${summary.insights}`,
    `Journal: ${summary.journalEntries}`,
    `Decisions: ${summary.decisions}`,
    `Reflections: ${summary.reflections}`,
    `Learning plans: ${summary.learningPlans}`
  ].join('\n');
}

function journalPrompt() {
  return [
    'Journal Reflection',
    '',
    'Jawab singkat saja:',
    '- Apa hal paling penting hari ini?',
    '- Apa yang berjalan baik?',
    '- Apa yang membingungkan?',
    '- Apa satu hal kecil yang bisa diperbaiki besok?',
    '',
    'Kirim dengan format:',
    '/journal isi refleksi kamu'
  ].join('\n');
}

function normalizeType(type = '') {
  const clean = String(type || '').replace('/', '').replace(/-/g, '_').toLowerCase();
  if (clean === 'learnplan') return 'learning';
  if (clean === 'mentalmodel') return 'mental_model';
  if (clean === 'think') return 'thinking';
  if (clean === 'reflect' || clean === 'journal') return 'reflection';
  if (clean === 'strategy') return 'strategy';
  if (clean === 'decision') return 'decision';
  if (clean === 'blindspot') return 'blindspot';
  if (clean === 'assumptions') return 'assumptions';
  if (clean === 'perspectives') return 'perspectives';
  if (clean === 'insight') return 'insight';
  if (clean === 'collab') return 'status';
  return clean || 'thinking';
}

function fallbackText(input = '') {
  return [
    'Thinking Partner',
    '',
    `Topik: ${utils.compactText(input || 'belum ada topik', 180)}`,
    'Aku bisa bantu memecah masalah ini, tapi konteksnya masih terbatas.',
    '',
    'Next action:',
    '- Jelaskan tujuan, batasan, dan bagian yang paling membingungkan.'
  ].join('\n');
}

function createResponse(command, text, userId, user, services = {}) {
  const type = utils.commandToType(command);
  if (command === '/journal' && !String(text || '').trim()) return journalPrompt();
  return handleCollaborationRequest(type, userId, text, services, { user });
}

module.exports = {
  buildCollaborationContext,
  buildStatus,
  createResponse,
  handleCollaborationRequest,
  journalPrompt,
  normalizeType,
  runCollaborationFlow
};

'use strict';

const guards = require('./guards');
const contextSync = require('./context-sync');
const memoryBus = require('./memory-bus');
const unifiedMemory = require('./unified-memory');
const goalManager = require('./goal-manager');
const workflowEngine = require('./workflow-engine');
const knowledgeGraph = require('./knowledge-graph');
const strategicReasoning = require('./strategic-reasoning');
const reflectionEngine = require('./reflection-engine');
const metaReasoning = require('./meta-reasoning');
const personalIntelligence = require('./personal-intelligence');
const researchIntelligence = require('./research-intelligence');
const cognitiveWorkspace = require('./cognitive-workspace');
const learningEvolution = require('./learning-evolution');
const cognitiveAnalytics = require('./cognitive-analytics');

class CognitiveCore {
  prepareInput(traceId, input = {}, botServices) {
    const userId = guards.normalizeUserId(input.userId);
    const userMessage = guards.sanitizeText(input.userMessage || input.query || '', 3200);
    const strategy = metaReasoning.chooseStrategy({
      userMessage,
      userMode: input.userMode || input.mode,
      hasAttachment: input.hasAttachment
    });

    const state = guards.ensureAIOSState(userId, botServices);
    const recursion = guards.recursiveReasoningGuard(input.traceState || {});
    if (!recursion.ok) {
      return {
        ok: false,
        strategy,
        promptContext: '',
        promptRules: 'AI OS guard aktif: gunakan jawaban sederhana dan hindari reasoning rekursif.',
        reason: recursion.reason
      };
    }

    if (!strategy.shouldUseAIOS) {
      return {
        ok: true,
        strategy,
        promptContext: '',
        promptRules: metaReasoning.explainStrategy(strategy),
        cognitiveContext: null,
        state
      };
    }

    const cognitiveContext = contextSync.syncContext(userId, userMessage, botServices, {
      maxChars: strategy.maxContextChars,
      skipMemory: !strategy.needMemory,
      skipGraph: !strategy.needGraphEvolution || strategy.moduleBudget?.shouldDeferLowPriority
    });
    const strategic = strategy.needStrategicReasoning
      ? strategicReasoning.analyzeGoal(userMessage, cognitiveContext)
      : null;
    const personal = strategy.mode === 'personal-intelligence'
      ? personalIntelligence.getProfile(userId, botServices)
      : null;
    const research = strategy.needResearch && !strategy.moduleBudget?.shouldDeferLowPriority
      ? researchIntelligence.buildResearchContext(userId, userMessage, botServices)
      : null;

    const promptContext = buildPromptContext({
      cognitiveContext,
      strategic,
      personal,
      research,
      strategy
    });

    return {
      ok: true,
      strategy,
      cognitiveContext,
      strategic,
      personal,
      research,
      promptContext,
      promptRules: buildPromptRules(strategy),
      state
    };
  }

  afterResponse(traceId, input = {}, response = '', botServices) {
    const userId = guards.normalizeUserId(input.userId);
    const userMessage = guards.sanitizeText(input.userMessage || input.query || '', 3200);
    if (!userMessage && !response) return { ok: false, reason: 'EMPTY_INTERACTION' };

    const state = guards.ensureAIOSState(userId, botServices);
    const strategy = input.strategy || metaReasoning.chooseStrategy({ userMessage, userMode: input.userMode || input.mode });
    const cleanResponse = guards.sanitizeText(response, 3600);
    const reflection = reflectionEngine.reflect(userId, userMessage, cleanResponse, botServices);

    memoryBus.publish(userId, {
      type: 'episodic',
      content: `Percakapan: ${guards.compactText(userMessage, 260)} -> ${guards.compactText(cleanResponse, 360)}`,
      tags: ['conversation', strategy.mode],
      source: 'cognitive-core',
      confidence: reflection.evaluation.confidence,
      importance: guards.importanceFromText(`${userMessage} ${cleanResponse}`, 'episodic')
    }, botServices);

    if (strategy.needStrategicReasoning || /goal|tujuan|roadmap|strategi|workflow/i.test(userMessage)) {
      const insight = reflection.insight || guards.compactText(userMessage, 240);
      learningEvolution.storeLearningInsight(userId, insight, botServices, {
        tags: ['strategic', 'ai-os'],
        confidence: reflection.evaluation.confidence,
        importance: 0.72
      });
    }

    if (strategy.needGraphEvolution) {
      knowledgeGraph.evolveGraphFromText(userId, `${userMessage}\n${cleanResponse}`, botServices, {
        source: 'cognitive-core',
        confidence: reflection.evaluation.confidence
      });
      knowledgeGraph.cleanupStaleGraph(userId, botServices);
    }

    if (strategy.needWorkflowUpdate) {
      updateLikelyWorkflow(userId, userMessage, cleanResponse, botServices);
    }

    const analytics = cognitiveAnalytics.collect(userId, botServices);
    guards.touchState(state);
    guards.persistAsync(botServices);
    return {
      ok: true,
      reflection,
      analytics
    };
  }

  getStatus(userId, botServices) {
    const analytics = cognitiveAnalytics.collect(userId, botServices);
    const insights = memoryBus.getRecentInsights(userId, botServices, 5);
    return {
      ...analytics,
      recentInsightsText: insights.map((item) => `- ${guards.compactText(item.text, 140)}`).join('\n') || '-'
    };
  }

  resetUserData(userId, botServices) {
    const { ensureUser } = botServices;
    const u = ensureUser(userId);
    u.aios = guards.makeEmptyState();
    clearStorageBuckets(userId, botServices);
    guards.persistAsync(botServices);
    return { ok: true };
  }
}

function clearStorageBuckets(userId, botServices = {}) {
  const storage = botServices.storageManager;
  if (!storage?.loadData || !storage?.saveData) return;
  const id = guards.normalizeUserId(userId);
  const keys = ['aios_memories', 'aios_goals', 'aios_workflows', 'aios_insights', 'aios_graph', 'collaboration_state'];
  Promise.all(keys.map(async (key) => {
    const bucket = await storage.loadData(key, {});
    if (bucket && typeof bucket === 'object') {
      bucket[id] = [];
      await storage.saveData(key, bucket);
    }
  })).catch(() => {});
}

function buildPromptRules(strategy = {}) {
  return [
    '[AI OS CONTROL]',
    metaReasoning.explainStrategy(strategy),
    '- Gunakan context AI OS secara selektif; jangan membuka data internal yang tidak perlu.',
    '- Bedakan fakta, inferensi, asumsi, risiko, dan trade-off jika keputusan bersifat strategis.',
    '- Jika confidence rendah untuk aksi, minta klarifikasi atau fallback ke percakapan biasa.',
    '- Jangan menjalankan tool hanya karena ada kata kunci; pahami tujuan user dulu.'
  ].join('\n');
}

function buildPromptContext(packet = {}) {
  const lines = [
    '[AI OS PERSISTENT CONTEXT]',
    packet.cognitiveContext?.compressedContext || '-'
  ];
  if (packet.strategic) {
    lines.push(
      '',
      '[STRATEGIC REASONING SNAPSHOT]',
      `Confidence: ${packet.strategic.confidence.toFixed(2)}`,
      `Risiko: ${(packet.strategic.risks || []).join(' | ') || '-'}`,
      `Trade-off: ${(packet.strategic.tradeOffs || []).join(' | ') || '-'}`,
      `Next action: ${(packet.strategic.nextActions || []).join(' | ') || '-'}`
    );
  }
  if (packet.personal) {
    lines.push(
      '',
      '[PERSONAL INTELLIGENCE SNAPSHOT]',
      `Learning style: ${packet.personal.learningStyle}`,
      `Confidence: ${packet.personal.confidence.toFixed(2)}`,
      `Basis: ${packet.personal.basis}`
    );
  }
  if (packet.research && packet.research !== '-') {
    lines.push('', '[RESEARCH CONTINUITY]', packet.research);
  }
  return guards.compactText(lines.join('\n'), 2800);
}

function updateLikelyWorkflow(userId, userMessage, response, botServices) {
  const active = workflowEngine.listActiveWorkflows(userId, botServices, 3);
  if (!active.length) return null;
  const target = active
    .map((workflow) => ({
      workflow,
      score: guards.textRelevance(userMessage, `${workflow.title} ${workflow.description}`)
    }))
    .sort((a, b) => b.score - a.score)[0];
  if (!target || target.score < 0.18) return null;
  return workflowEngine.appendWorkflowMemory(
    userId,
    target.workflow.id,
    `Update percakapan: ${guards.compactText(userMessage, 220)} | ${guards.compactText(response, 260)}`,
    botServices
  );
}

module.exports = new CognitiveCore();

'use strict';

const core = require('./collaboration-core');
const store = require('./collaboration-store');
const intentUnderstanding = require('./intent-understanding');
const goalAnalyzer = require('./cognitive-goal-analyzer');
const thinkingPartner = require('./thinking-partner');
const strategicThinking = require('./strategic-thinking-engine');
const reflectionSystem = require('./reflection-system');
const criticalThinking = require('./critical-thinking-assistant');
const learningIntelligence = require('./learning-intelligence');
const mentalModel = require('./mental-model-engine');
const workspace = require('./cognitive-workspace');
const deepAnalysis = require('./deep-analysis-framework');
const decisionSupport = require('./decision-support');
const insightGenerator = require('./insight-generator');
const personalIntelligence = require('./personal-intelligence');
const collaborativeReasoning = require('./collaborative-reasoning');
const analytics = require('./collaboration-analytics');
const guards = require('./collaboration-guards');
const utils = require('./collaboration-utils');

function createCollaborationSystem() {
  const system = {
    commands: new Set([
      '/think',
      '/strategy',
      '/reflect',
      '/learnplan',
      '/mentalmodel',
      '/decision',
      '/blindspot',
      '/assumptions',
      '/perspectives',
      '/insight',
      '/journal',
      '/collab',
      '/collab-reset'
    ]),
    async respond(command, text, userId, user, services = {}) {
      await store.hydrate(userId, user, services);
      if (command === '/collab-reset') {
        store.reset(user);
        await store.mirror(userId, user, services);
        return 'Data Human-AI Collaboration untuk user ini sudah direset. Memory utama tidak dihapus.';
      }
      if (command === '/journal' && String(text || '').trim()) {
        const collab = store.ensureCollab(user);
        store.appendBounded(collab.journal, {
          id: `jr_${Date.now()}`,
          content: String(text || '').trim().slice(0, 1200),
          createdAt: new Date().toISOString()
        });
      }
      const output = await core.createResponse(command, text, userId, user, services);
      await store.mirror(userId, user, services);
      return output;
    },
    modules: {
      core,
      intentUnderstanding,
      goalAnalyzer,
      thinkingPartner,
      strategicThinking,
      reflectionSystem,
      criticalThinking,
      learningIntelligence,
      mentalModel,
      workspace,
      deepAnalysis,
      decisionSupport,
      insightGenerator,
      personalIntelligence,
      collaborativeReasoning,
      analytics,
      guards,
      utils,
      store
    },
    collaborationCore: core,
    thinkingPartner,
    strategicThinkingEngine: strategicThinking,
    reflectionSystem,
    learningIntelligence,
    mentalModelEngine: mentalModel,
    decisionSupport,
    criticalThinkingAssistant: criticalThinking,
    insightGenerator,
    collaborationGuards: guards,
    collaborationUtils: utils
  };
  return system;
}

module.exports = createCollaborationSystem();
module.exports.createCollaborationSystem = createCollaborationSystem;

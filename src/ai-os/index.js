'use strict';

const cognitiveCore = require('./cognitive-core');
const contextSync = require('./context-sync');
const memoryBus = require('./memory-bus');
const unifiedMemory = require('./unified-memory');
const goalManager = require('./goal-manager');
const workflowEngine = require('./workflow-engine');
const insightStore = require('./insight-store');
const knowledgeGraph = require('./knowledge-graph');
const semanticRelationshipEngine = require('./semantic-relationship-engine');
const strategicReasoning = require('./strategic-reasoning');
const reflectionEngine = require('./reflection-engine');
const metaReasoning = require('./meta-reasoning');
const personalIntelligence = require('./personal-intelligence');
const researchIntelligence = require('./research-intelligence');
const cognitiveWorkspace = require('./cognitive-workspace');
const learningEvolution = require('./learning-evolution');
const cognitiveAnalytics = require('./cognitive-analytics');
const naturalIntegration = require('./natural-integration');
const legacyGuards = require('./guards');
const guards = require('./aios-guards');
const utils = require('./aios-utils');

function createAIOS() {
  return {
    cognitiveCore,
    contextSync,
    memoryBus,
    unifiedMemory,
    goalManager,
    workflowEngine,
    insightStore,
    knowledgeGraph,
    semanticRelationshipEngine,
    strategicReasoning,
    reflectionEngine,
    metaReasoning,
    personalIntelligence,
    researchIntelligence,
    cognitiveWorkspace,
    learningEvolution,
    cognitiveAnalytics,
    naturalIntegration,
    guards,
    legacyGuards,
    utils,
    processInput: cognitiveCore.prepareInput.bind(cognitiveCore),
    afterResponse: cognitiveCore.afterResponse.bind(cognitiveCore),
    getStatus: cognitiveCore.getStatus.bind(cognitiveCore),
    resetUserData: cognitiveCore.resetUserData.bind(cognitiveCore)
  };
}

module.exports = createAIOS();
module.exports.createAIOS = createAIOS;

'use strict';

const knowledgeGraphStore = require('./knowledge-graph-store');
const knowledgeNodeManager = require('./knowledge-node-manager');
const knowledgeEdgeManager = require('./knowledge-edge-manager');
const projectKnowledgeIngestor = require('./project-knowledge-ingestor');
const decisionMemoryManager = require('./decision-memory-manager');
const memoryGovernancePolicy = require('./memory-governance-policy');
const memorySafetyGate = require('./memory-safety-gate');
const memoryDeduplicator = require('./memory-deduplicator');
const memoryStalenessReviewer = require('./memory-staleness-reviewer');
const contextRetrievalEngine = require('./context-retrieval-engine');
const documentationIntelligence = require('./documentation-intelligence');
const knowledgeReportGenerator = require('./knowledge-report-generator');
const knowledgeUtils = require('./knowledge-utils');

module.exports = {
  knowledgeGraphStore,
  knowledgeNodeManager,
  knowledgeEdgeManager,
  projectKnowledgeIngestor,
  decisionMemoryManager,
  memoryGovernancePolicy,
  memorySafetyGate,
  memoryDeduplicator,
  memoryStalenessReviewer,
  contextRetrievalEngine,
  documentationIntelligence,
  knowledgeReportGenerator,
  knowledgeUtils
};

'use strict';

module.exports = {
  documentationAgent: require('./documentation-agent'),
  documentationDraftGenerator: require('./documentation-draft-generator'),
  documentationUpdatePlanner: require('./documentation-update-planner'),
  evidenceExtractor: require('./evidence-extractor'),
  researchFreshnessChecker: require('./research-freshness-checker'),
  researchGapDetector: require('./research-gap-detector'),
  researchKnowledgeLinker: require('./research-knowledge-linker'),
  researchReportGenerator: require('./research-report-generator'),
  researchSafetyGate: require('./research-safety-gate'),
  researchStore: require('./research-store'),
  researchSummarizer: require('./research-summarizer'),
  researchTaskPlanner: require('./research-task-planner'),
  researchUtils: require('./research-utils'),
  sourceCollector: require('./source-collector'),
  sourceCredibilityScorer: require('./source-credibility-scorer'),

  researchTaskManager: require('./research-task-manager'),
  researchIntentClassifier: require('./research-intent-classifier'),
  sourceRegistry: require('./source-registry'),
  sourceQualityScorer: require('./source-quality-scorer'),
  researchNoteBuilder: require('./research-note-builder'),
  comparisonMatrixGenerator: require('./comparison-matrix-generator'),
  implementationNoteGenerator: require('./implementation-note-generator'),
  researchRiskReviewer: require('./research-risk-reviewer'),
  researchPromptGenerator: require('./research-prompt-generator'),
  researchProposalBridge: require('./research-proposal-bridge')
};

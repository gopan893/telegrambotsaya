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
  sourceCredibilityScorer: require('./source-credibility-scorer')
};


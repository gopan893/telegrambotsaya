'use strict';

const improvementUtils = require('./improvement-utils');
const improvementStore = require('./improvement-store');
const feedbackCollector = require('./feedback-collector');
const outcomeCollector = require('./outcome-collector');
const qualitySignalClassifier = require('./quality-signal-classifier');
const weaknessDetector = require('./weakness-detector');
const patternAnalyzer = require('./pattern-analyzer');
const lessonManager = require('./lesson-manager');
const regressionCaseGenerator = require('./regression-case-generator');
const improvementPlanGenerator = require('./improvement-plan-generator');
const nextAgentImprovementPrompt = require('./next-agent-improvement-prompt');
const improvementEvaluationGate = require('./improvement-evaluation-gate');
const improvementProposalBridge = require('./improvement-proposal-bridge');
const improvementReportGenerator = require('./improvement-report-generator');

module.exports = {
  ...improvementUtils,
  ...improvementStore,
  ...feedbackCollector,
  ...outcomeCollector,
  ...qualitySignalClassifier,
  ...weaknessDetector,
  ...patternAnalyzer,
  ...lessonManager,
  ...regressionCaseGenerator,
  ...improvementPlanGenerator,
  ...nextAgentImprovementPrompt,
  ...improvementEvaluationGate,
  ...improvementProposalBridge,
  ...improvementReportGenerator,
  // Grouped namespaces
  utils: improvementUtils,
  store: improvementStore,
  feedback: feedbackCollector,
  outcomes: outcomeCollector,
  classifier: qualitySignalClassifier,
  weaknesses: weaknessDetector,
  patterns: patternAnalyzer,
  lessons: lessonManager,
  regression: regressionCaseGenerator,
  plans: improvementPlanGenerator,
  prompts: nextAgentImprovementPrompt,
  evalGate: improvementEvaluationGate,
  proposals: improvementProposalBridge,
  reports: improvementReportGenerator
};

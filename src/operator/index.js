'use strict';

const projectOperatorStore = require('./project-operator-store');
const projectGoalAnalyzer = require('./project-goal-analyzer');
const operatorPlanner = require('./operator-planner');
const operatorTaskBreakdown = require('./operator-task-breakdown');
const operatorAgentCoordinator = require('./operator-agent-coordinator');
const operatorProgressTracker = require('./operator-progress-tracker');
const operatorDecisionEngine = require('./operator-decision-engine');
const operatorRiskReview = require('./operator-risk-review');
const operatorCostGuard = require('./operator-cost-guard');
const operatorEvaluationGate = require('./operator-evaluation-gate');
const operatorProposalBridge = require('./operator-proposal-bridge');
const operatorReportGenerator = require('./operator-report-generator');
const operatorUtils = require('./operator-utils');

let knowledgeBridge = null;
try {
  const ingestor = require('../knowledge/project-knowledge-ingestor');
  knowledgeBridge = {
    ingestProjectGoal: ingestor.ingestProjectGoal,
    ingestOperatorPlan: ingestor.ingestOperatorPlan,
    ingestTask: ingestor.ingestTask
  };
} catch (_) {
  knowledgeBridge = null;
}

module.exports = {
  projectOperatorStore,
  projectGoalAnalyzer,
  operatorPlanner,
  operatorTaskBreakdown,
  operatorAgentCoordinator,
  operatorProgressTracker,
  operatorDecisionEngine,
  operatorRiskReview,
  operatorCostGuard,
  operatorEvaluationGate,
  operatorProposalBridge,
  operatorReportGenerator,
  operatorUtils,
  knowledgeBridge
};

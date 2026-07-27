'use strict';

const codingUtils = require('./coding-utils');
const { STORAGE_KEYS, createWorkspaceModel } = require('./coding-workspace-store');
const { classifyRequest, CODING_KEYWORDS, AGENT_MAP } = require('./coding-request-classifier');
const { getRepoContext, updateRepoContext, getProjectConstraints, buildRepoSafeSummary, detectMissingRepoConfig } = require('./repo-context-manager');
const { createCodeChangePlan, createPlanFromBugReport, createPlanFromFeatureRequest, createPlanFromPhasePrompt, createMinimalPatchStrategy, createCompatibilityChecklist } = require('./code-change-planner');
const { reviewCodingPlanRisk, detectRegressionRisk, detectSecurityRisk, detectCompatibilityRisk, buildRiskReviewSummary } = require('./regression-risk-reviewer');
const { generateTestPlan, generateRegressionTests, generateManualTestPlan, generateSmokeTestCommands } = require('./test-plan-generator');
const { generateCodexPrompt, generateHotfixPrompt, generatePhasePrompt, generateCompactPrompt } = require('./codex-prompt-generator');
const { buildGithubIssueProposal, buildGithubPrProposal, buildGithubCommentProposal, createGithubProposalAfterEvaluation } = require('./github-proposal-builder');
const { createCodingTask, listCodingTasks, listCodingTasksAsync, updateCodingTaskStatus, linkCodingTaskToPlan, linkCodingTaskToProposal, TASK_STATUSES } = require('./coding-task-tracker');
const { synthesizeCodingReview, formatShortSummary } = require('./coding-review-synthesis');
const { CODING_EVALUATION_CASES, runCodingEvaluationCases, generateCodingScores } = require('./coding-evaluation-cases');

module.exports = {
  // Utils
  ...codingUtils,

  // Workspace store
  STORAGE_KEYS,
  createWorkspaceModel,

  // Classifier
  classifyRequest,
  CODING_KEYWORDS,
  AGENT_MAP,

  // Repo context
  getRepoContext,
  updateRepoContext,
  getProjectConstraints,
  buildRepoSafeSummary,
  detectMissingRepoConfig,

  // Change planner
  createCodeChangePlan,
  createPlanFromBugReport,
  createPlanFromFeatureRequest,
  createPlanFromPhasePrompt,
  createMinimalPatchStrategy,
  createCompatibilityChecklist,

  // Risk reviewer
  reviewCodingPlanRisk,
  detectRegressionRisk,
  detectSecurityRisk,
  detectCompatibilityRisk,
  buildRiskReviewSummary,

  // Test plan
  generateTestPlan,
  generateRegressionTests,
  generateManualTestPlan,
  generateSmokeTestCommands,

  // Codex prompt
  generateCodexPrompt,
  generateHotfixPrompt,
  generatePhasePrompt,
  generateCompactPrompt,

  // GitHub proposal
  buildGithubIssueProposal,
  buildGithubPrProposal,
  buildGithubCommentProposal,
  createGithubProposalAfterEvaluation,

  // Task tracker
  createCodingTask,
  listCodingTasks,
  listCodingTasksAsync,
  updateCodingTaskStatus,
  linkCodingTaskToPlan,
  linkCodingTaskToProposal,
  TASK_STATUSES,

  // Review synthesis
  synthesizeCodingReview,
  formatShortSummary,

  // Evaluation
  CODING_EVALUATION_CASES,
  runCodingEvaluationCases,
  generateCodingScores
};

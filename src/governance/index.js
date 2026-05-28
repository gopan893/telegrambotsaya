'use strict';

const safetyValidator = require('./safety-validator');
const approvalLayer = require('./approval-layer');
const auditLogger = require('./audit-logger');
const rollbackController = require('./rollback-controller');
const policyEngine = require('./policy-engine');
const permissionEngine = require('./permission-engine');
const riskAssessment = require('./risk-assessment');
const explainability = require('./explainability');

function reviewDecision(traceId, input) {
  return safetyValidator.reviewDecision(traceId, input);
}

function consumeApprovedAction(traceId, userId, userMessage, botServices) {
  return approvalLayer.consumeApprovedAction(traceId, userId, userMessage, botServices);
}

function createRecoverySnapshot(traceId, userId, reason, botServices) {
  return rollbackController.createRecoverySnapshot(traceId, userId, reason, botServices);
}

function rollbackLastSnapshot(traceId, userId, botServices) {
  return rollbackController.rollbackLastSnapshot(traceId, userId, botServices);
}

function logToolExecution(traceId, input) {
  return auditLogger.logToolExecution(traceId, input);
}

function getGovernanceStatus() {
  return {
    policies: policyEngine.listPolicies().map((policy) => ({
      intent: policy.intent,
      capability: policy.capability,
      riskLevel: policy.riskLevel,
      requiresApproval: policy.requiresApproval,
      requiresAdmin: policy.requiresAdmin
    })),
    audit: auditLogger.getAnalytics()
  };
}

module.exports = {
  reviewDecision,
  consumeApprovedAction,
  createRecoverySnapshot,
  rollbackLastSnapshot,
  logToolExecution,
  getGovernanceStatus,
  policyEngine,
  permissionEngine,
  riskAssessment,
  explainability,
  auditLogger,
  approvalLayer,
  rollbackController
};

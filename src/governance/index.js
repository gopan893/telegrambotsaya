'use strict';

const safetyValidator = require('./safety-validator');
const approvalLayer = require('./approval-layer');
const auditLogger = require('./audit-logger');
const rollbackController = require('./rollback-controller');
const policyEngine = require('./policy-engine');
const permissionEngine = require('./permission-engine');
const riskAssessment = require('./risk-assessment');
const explainability = require('./explainability');

const governancePolicyStore = require('./governance-policy-store');
const capabilityRegistry = require('./capability-registry');
const capabilityContracts = require('./capability-contracts');
const unifiedPermissionEngine = require('./unified-permission-engine');
const unifiedRiskEngine = require('./unified-risk-engine');
const unifiedSecretGuard = require('./unified-secret-guard');
const unifiedApprovalPolicy = require('./unified-approval-policy');
const unifiedEvaluationPolicy = require('./unified-evaluation-policy');
const unifiedCostPolicy = require('./unified-cost-policy');
const actionPolicySimulator = require('./action-policy-simulator');
const governanceDecisionEngine = require('./governance-decision-engine');
const governanceAudit = require('./governance-audit');
const governanceUtils = require('./governance-utils');

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
  const capIndex = capabilityRegistry.buildCapabilityIndex();
  const auditStats = governanceAudit.getAuditStats();
  const policy = governancePolicyStore.getGovernancePolicy();
  const recentDecisions = governanceDecisionEngine.getRecentDecisions(10);

  return {
    version: '2.0.0',
    unifiedPolicy: true,
    policy: {
      rules: Object.keys(policy.rules).length,
      approvalFlow: policy.approvalFlow
    },
    capabilities: {
      total: capIndex.totalCapabilities,
      modules: Object.keys(capIndex.byModule).length,
      actionTypes: Object.keys(capIndex.byActionType).length
    },
    audit: {
      totalEvents: auditStats.totalEvents,
      recentSummary: auditStats.recentSummary
    },
    recentDecisions: recentDecisions.map(d => ({
      id: d.id,
      actionId: d.actionId,
      outcome: d.outcome,
      riskLevel: d.riskLevel,
      allowed: d.allowed,
      blocked: d.blocked,
      timestamp: d.timestamp
    })),
    legacy: {
      policies: policyEngine.listPolicies().map((p) => ({
        intent: p.intent,
        capability: p.capability,
        riskLevel: p.riskLevel,
        requiresApproval: p.requiresApproval,
        requiresAdmin: p.requiresAdmin
      })),
      audit: auditLogger.getAnalytics()
    }
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
  rollbackController,

  governancePolicyStore,
  capabilityRegistry,
  capabilityContracts,
  unifiedPermissionEngine,
  unifiedRiskEngine,
  unifiedSecretGuard,
  unifiedApprovalPolicy,
  unifiedEvaluationPolicy,
  unifiedCostPolicy,
  actionPolicySimulator,
  governanceDecisionEngine,
  governanceAudit,
  governanceUtils
};

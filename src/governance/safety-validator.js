'use strict';

const observability = require('../agents/observability');
const policyEngine = require('./policy-engine');
const permissionEngine = require('./permission-engine');
const riskAssessment = require('./risk-assessment');
const approvalLayer = require('./approval-layer');
const auditLogger = require('./audit-logger');
const explainability = require('./explainability');

function simulateAction(traceId, input = {}) {
  const params = input.params || {};
  const warnings = [];
  let wouldMutateState = false;

  if (['TAMBAH_TUGAS', 'TAMBAH_PENGINGAT', 'TAMBAH_EVENT', 'TAMBAH_MOOD'].includes(String(input.intent || '').toUpperCase())) {
    wouldMutateState = true;
  }
  if (String(input.intent || '').toUpperCase() === 'TAMBAH_EVENT' && (!params.startDate || !params.summary)) {
    warnings.push('CALENDAR_EVENT_PARAMS_INCOMPLETE');
  }
  if (String(input.intent || '').toUpperCase() === 'TAMBAH_PENGINGAT' && (!params.time || !params.message)) {
    warnings.push('REMINDER_PARAMS_INCOMPLETE');
  }

  const simulation = {
    ok: warnings.length === 0,
    wouldMutateState,
    warnings
  };

  observability.logEvent(traceId, 'SafetyValidator', 'ACTION_SIMULATED', {
    intent: input.intent,
    ok: simulation.ok,
    wouldMutateState,
    warningCount: warnings.length
  });

  return simulation;
}

function reviewDecision(traceId, input = {}) {
  const risk = riskAssessment.assessActionRisk(traceId, input);
  const policyValidation = policyEngine.validatePolicy(traceId, {
    intent: input.intent,
    riskScore: risk.riskScore,
    nlpConfidence: input.nlpConfidence,
    flags: risk.flags,
    approved: input.approved
  });
  const permission = permissionEngine.validatePermission(traceId, input.userId, policyValidation.policy, input.botServices);
  const simulation = simulateAction(traceId, input);
  const violations = [...policyValidation.violations];

  if (!permission.allowed) violations.push(permission.reason);
  if (!simulation.ok && policyValidation.policy.riskLevel !== 'low') violations.push('SIMULATION_WARNING');
  if (risk.recommendedAction === 'BLOCK') violations.push('RISK_ENGINE_BLOCK');

  let decision = 'ALLOW';
  let executionAllowed = true;

  if (
    !permission.allowed ||
    risk.recommendedAction === 'BLOCK' ||
    violations.includes('UNTRUSTED_CONTEXT_OR_INPUT') ||
    violations.includes('SIMULATION_WARNING')
  ) {
    decision = 'BLOCKED';
    executionAllowed = false;
  } else if (violations.includes('LOW_CONFIDENCE_FOR_NON_LOW_RISK_ACTION')) {
    decision = 'SAFE_FALLBACK';
    executionAllowed = false;
  } else if (policyValidation.requiresApproval || (risk.requiresApproval && !input.approved)) {
    decision = 'APPROVAL_REQUIRED';
    executionAllowed = false;
  } else if (violations.includes('RISK_SCORE_EXCEEDS_POLICY')) {
    decision = input.approved ? 'CONTROLLED_EXECUTION' : 'APPROVAL_REQUIRED';
    executionAllowed = !!input.approved;
  } else if (input.intent !== 'NONE' && risk.recommendedAction === 'SAFE_FALLBACK') {
    decision = 'SAFE_FALLBACK';
    executionAllowed = false;
  } else if (risk.recommendedAction === 'CONTROLLED_EXECUTION') {
    decision = 'CONTROLLED_EXECUTION';
    executionAllowed = true;
  }

  const baseDecision = {
    userId: input.userId,
    intent: policyValidation.policy.intent,
    params: input.params || {},
    policy: policyValidation.policy,
    permission,
    risk,
    simulation,
    violations: [...new Set(violations)],
    decision,
    executionAllowed,
    approved: !!input.approved
  };

  if (decision === 'APPROVAL_REQUIRED') {
    baseDecision.approvalId = approvalLayer.requestApproval(traceId, input.userId, {
      intent: policyValidation.policy.intent,
      params: input.params || {},
      userMessage: input.userMessage,
      risk,
      policy: policyValidation.policy
    }, input.botServices);
  } else {
    auditLogger.logDecision(traceId, baseDecision);
  }

  baseDecision.explanation = explainability.explainDecision(baseDecision);
  baseDecision.userMessage = explainability.buildUserFacingDecision(baseDecision);
  baseDecision.promptConstraint = explainability.buildPromptConstraint(baseDecision);

  observability.logEvent(traceId, 'SafetyValidator', 'GOVERNANCE_REVIEW_COMPLETED', {
    intent: baseDecision.intent,
    decision,
    executionAllowed,
    riskLevel: risk.riskLevel
  });

  return baseDecision;
}

module.exports = {
  reviewDecision,
  simulateAction
};

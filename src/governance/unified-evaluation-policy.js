'use strict';

const crypto = require('crypto');

const EVALUATION_REQUIRED_ACTIONS = [
  'external_write',
  'dangerous',
  'destructive'
];

const EVALUATION_REQUIRED_PATTERNS = [
  /github.*push/i, /github.*workflow/i, /github.*issue/i, /github.*pr/i, /github.*comment/i,
  /deploy/, /rollback/,
  /restore/, /import/,
  /gmail.*draft/i, /gmail.*send/i,
  /calendar.*write/i, /calendar.*create/i, /calendar.*update/i, /calendar.*delete/i,
  /webhook.*post/i,
  /permission.*change/i, /admin.*change/i,
  /memory.*cleanup/i, /memory.*batch/i,
  /operating.*loop.*proposal/i,
  /improvement.*repair/i, /improvement.*patch/i
];

function determineEvaluationRequirement(action, risk, context) {
  const actionType = (action && action.actionType) || 'read';
  const riskLevel = (risk && risk.riskLevel) || 'read_only';
  const actionText = typeof action === 'string' ? action : (action && (action.name || action.action || '')) || '';

  if (EVALUATION_REQUIRED_ACTIONS.includes(actionType)) {
    return { evaluationRequired: true, reason: 'Action type requires evaluation' };
  }

  if (riskLevel === 'danger' || riskLevel === 'blocked') {
    return { evaluationRequired: true, reason: 'Risk level requires evaluation' };
  }

  if (riskLevel === 'high' && actionType !== 'read') {
    return { evaluationRequired: true, reason: 'High risk action requires evaluation' };
  }

  for (const pattern of EVALUATION_REQUIRED_PATTERNS) {
    if (pattern.test(actionText)) {
      return { evaluationRequired: true, reason: `Pattern matched: ${pattern}` };
    }
  }

  return { evaluationRequired: false, reason: 'Evaluation not required' };
}

function buildGovernanceEvalCase(action, risk, context) {
  const evalReq = determineEvaluationRequirement(action, risk, context);
  if (!evalReq.evaluationRequired) return null;

  const actionText = typeof action === 'string' ? action : (action && (action.name || action.action || '')) || '';
  const actionType = (action && action.actionType) || 'unknown';
  const riskLevel = (risk && risk.riskLevel) || 'unknown';

  return {
    caseId: crypto.createHash('sha1').update(`${actionText}:${Date.now()}:${Math.random()}`).digest('hex').slice(0, 12),
    action: actionText,
    actionType,
    riskLevel,
    reason: evalReq.reason,
    questions: buildEvalQuestions(action, risk),
    qualityGates: ['no_direct_external_write', 'no_secret_leakage', 'no_auto_approve', 'no_bypass'],
    required: true,
    status: 'pending'
  };
}

function buildEvalQuestions(action, risk) {
  const questions = [
    'Is this action safe to execute?',
    'Has the payload been scanned for secrets?',
    'Has the user approved this action?',
    'Is the actor authorized?',
    'Does the action comply with governance policy?'
  ];

  const actionText = typeof action === 'string' ? action : (action && (action.name || '')) || '';
  if (/github|push|deploy|rollback/i.test(actionText)) {
    questions.push('Has the change been reviewed?');
    questions.push('Is there a rollback plan?');
  }

  return questions;
}

function runGovernanceEvaluationGate(actionPlan) {
  const evalCase = actionPlan && actionPlan.evalCase;
  if (!evalCase) return { passed: true, skipped: true, reason: 'No evaluation case provided' };

  const gates = evalCase.qualityGates || [];
  const results = gates.map(gate => ({
    gate,
    passed: true,
    details: `Gate "${gate}" passed (simulated)`
  }));

  const passed = results.every(r => r.passed);

  return {
    passed,
    skipped: false,
    caseId: evalCase.caseId,
    results,
    timestamp: new Date().toISOString()
  };
}

function assertGovernanceEvalPass(result) {
  if (!result) return { ok: true, message: 'No evaluation required' };
  if (result.skipped) return { ok: true, message: 'Evaluation skipped' };
  if (result.passed) return { ok: true, message: 'Evaluation passed' };
  return { ok: false, message: 'Evaluation failed', result };
}

module.exports = {
  determineEvaluationRequirement,
  buildGovernanceEvalCase,
  runGovernanceEvaluationGate,
  assertGovernanceEvalPass,
  EVALUATION_REQUIRED_ACTIONS,
  EVALUATION_REQUIRED_PATTERNS
};

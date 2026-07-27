'use strict';

const { SECRET_PATTERNS } = require('./improvement-utils');

const DIRECT_EXTERNAL_PATTERNS = [
  /github\.com.*push/i,
  /git push/i,
  /deploy/i,
  /rollback/i,
  /email/i,
  /calendar/i,
  /webhook/i,
  /gh workflow dispatch/i,
  /render deploy/i,
];

const SHELL_PATTERNS = [
  /shell/i,
  /exec\(/i,
  /spawn\(/i,
  /child_process/i,
  /\.sh\b/i,
  /bash/i,
  /zsh/i,
  /sh -c/i,
];

const GITHUB_PUSH_PATTERNS = [
  /github\.com.*push/i,
  /git push/i,
  /gh pr create/i,
  /gh release/i,
  /workflow_dispatch/i,
  /deploy to production/i,
];

function runImprovementEvaluationGate(plan, services) {
  const evalCase = buildImprovementEvalCase(plan, services);
  return assertImprovementSafety(evalCase);
}

function buildImprovementEvalCase(plan, services) {
  const planText = gatherPlanText(plan);
  return {
    planId: plan.id || '',
    title: plan.title || '',
    description: plan.description || '',
    actions: (plan.actions || []).map(a => ({
      type: a.type || '',
      targetType: a.targetType || '',
      targetId: a.targetId || '',
      description: a.description || '',
      riskLevel: a.riskLevel || 'medium',
    })),
    planText,
    riskLevel: plan.riskLevel || 'medium',
    requiresApproval: plan.requiresApproval !== false,
    approvalBoundary: plan.approvalBoundary || 'owner',
  };
}

function assertImprovementSafety(evalResult) {
  const checks = [
    assertNoDirectExternalWrite(evalResult),
    assertNoSecretLeak(evalResult),
    assertApprovalBoundary(evalResult),
    assertNoShellExecutor(evalResult),
    assertNoGithubPush(evalResult),
    assertNoAutoApprove(evalResult),
    assertNoDeployOrRollback(evalResult),
    assertNoSecretStorage(evalResult),
    assertNoUnsafeMemoryUpdate(evalResult),
  ];

  const failures = checks.filter(c => !c.passed);
  return {
    passed: failures.length === 0,
    checks,
    failures,
  };
}

function assertNoDirectExternalWrite(evalResult) {
  const text = evalResult.planText;
  const matches = DIRECT_EXTERNAL_PATTERNS.filter(p => p.test(text));
  const passed = matches.length === 0;
  return {
    name: 'no_direct_external_write',
    passed,
    detail: passed
      ? 'No direct external write pattern detected'
      : 'Direct external write pattern detected: ' + matches.map(m => m.source).join(', '),
  };
}

function assertNoSecretLeak(evalResult) {
  const text = evalResult.planText;
  const matches = SECRET_PATTERNS.filter(p => p.test(text));
  const passed = matches.length === 0;
  return {
    name: 'no_secret_leak',
    passed,
    detail: passed
      ? 'No secret pattern detected'
      : 'Secret pattern detected: ' + matches.map(m => m.source).join(', '),
  };
}

function assertApprovalBoundary(evalResult) {
  const validBoundaries = ['owner', 'admin', 'editor'];
  const boundary = evalResult.approvalBoundary || 'owner';
  const passed = validBoundaries.includes(boundary);
  return {
    name: 'approval_boundary_respected',
    passed,
    detail: passed
      ? `Approval boundary respected: ${boundary}`
      : `Invalid approval boundary: ${boundary}`,
  };
}

function assertNoShellExecutor(evalResult) {
  const text = evalResult.planText;
  const matches = SHELL_PATTERNS.filter(p => p.test(text));
  const passed = matches.length === 0;
  return {
    name: 'no_shell_executor',
    passed,
    detail: passed
      ? 'No shell executor pattern detected'
      : 'Shell executor pattern detected: ' + matches.map(m => m.source).join(', '),
  };
}

function assertNoGithubPush(evalResult) {
  const text = evalResult.planText;
  const matches = GITHUB_PUSH_PATTERNS.filter(p => p.test(text));
  const passed = matches.length === 0;
  return {
    name: 'no_github_push',
    passed,
    detail: passed
      ? 'No GitHub push pattern detected'
      : 'GitHub push pattern detected: ' + matches.map(m => m.source).join(', '),
  };
}

function assertNoAutoApprove(evalResult) {
  const text = evalResult.planText;
  const patterns = [/auto.approve/i, /auto.approval/i, /skip.approval/i, /approve.*automatically/i];
  const matches = patterns.filter(p => p.test(text));
  const passed = matches.length === 0;
  return {
    name: 'no_auto_approve',
    passed,
    detail: passed
      ? 'No auto-approve pattern detected'
      : 'Auto-approve pattern detected: ' + matches.map(m => m.source).join(', '),
  };
}

function assertNoDeployOrRollback(evalResult) {
  const text = evalResult.planText;
  const deployPatterns = [/deploy/i, /rollback/i];
  const matches = deployPatterns.filter(p => p.test(text));
  const passed = matches.length === 0;
  return {
    name: 'no_deploy_or_rollback',
    passed,
    detail: passed
      ? 'No deploy or rollback pattern detected'
      : 'Deploy/rollback pattern detected: ' + matches.map(m => m.source).join(', '),
  };
}

function assertNoSecretStorage(evalResult) {
  const text = evalResult.planText;
  const patterns = [/store.*secret/i, /save.*token/i, /persist.*credential/i, /save.*api.key/i];
  const matches = patterns.filter(p => p.test(text));
  const passed = matches.length === 0;
  return {
    name: 'no_secret_storage',
    passed,
    detail: passed
      ? 'No secret storage pattern detected'
      : 'Secret storage pattern detected: ' + matches.map(m => m.source).join(', '),
  };
}

function assertNoUnsafeMemoryUpdate(evalResult) {
  const text = evalResult.planText;
  const patterns = [/overwrite.*memory/i, /delete.*memory/i, /purge.*memory/i, /clear.*all.*memory/i];
  const matches = patterns.filter(p => p.test(text));
  const passed = matches.length === 0;
  return {
    name: 'no_unsafe_memory_update',
    passed,
    detail: passed
      ? 'No unsafe memory update pattern detected'
      : 'Unsafe memory update pattern detected: ' + matches.map(m => m.source).join(', '),
  };
}

function gatherPlanText(plan) {
  const parts = [];
  if (plan.title) parts.push(plan.title);
  if (plan.description) parts.push(plan.description);
  if (plan.goal) parts.push(plan.goal);
  for (const action of plan.actions || []) {
    parts.push(action.type || '');
    parts.push(action.description || '');
    parts.push(action.targetType || '');
    parts.push(action.targetId || '');
    if (action.payload && typeof action.payload === 'object') {
      parts.push(JSON.stringify(action.payload));
    }
  }
  if (plan.suggestedCode) parts.push(plan.suggestedCode);
  if (plan.executionPlan) parts.push(typeof plan.executionPlan === 'string' ? plan.executionPlan : JSON.stringify(plan.executionPlan));
  return parts.filter(Boolean).join('\n');
}

module.exports = {
  runImprovementEvaluationGate,
  buildImprovementEvalCase,
  assertImprovementSafety,
  assertNoDirectExternalWrite,
  assertNoSecretLeak,
  assertApprovalBoundary,
  assertNoShellExecutor,
  assertNoGithubPush,
  assertNoAutoApprove,
  assertNoDeployOrRollback,
  assertNoSecretStorage,
  assertNoUnsafeMemoryUpdate,
};

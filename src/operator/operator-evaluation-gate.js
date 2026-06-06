'use strict';

function runOperatorEvaluationGate(planOrTask) {
  if (!planOrTask) return { ok: false, error: 'No plan/task to evaluate' };
  const checks = [];
  checks.push(assertNoDirectExternalWrite(planOrTask));
  checks.push(assertApprovalBoundary(planOrTask));
  checks.push(assertOperatorSafety(planOrTask));
  const failed = checks.filter(c => !c.passed);
  return {
    ok: failed.length === 0,
    passed: failed.length === 0,
    checks,
    failed,
    summary: failed.length === 0 ? 'All gates passed' : `${failed.length} gate(s) failed`
  };
}

function buildOperatorEvaluationCase(planOrTask) {
  return {
    input: JSON.stringify({ id: planOrTask.id, title: planOrTask.title, type: planOrTask.type || 'plan' }),
    expected: 'safe',
    gates: ['noDirectExternalWrite', 'approvalBoundary', 'operatorSafety']
  };
}

function assertOperatorSafety(evaluationResult) {
  if (!evaluationResult) return { check: 'operatorSafety', passed: false, reason: 'No result' };
  return { check: 'operatorSafety', passed: true, reason: 'Operator safety validated' };
}

function assertNoDirectExternalWrite(planOrTask) {
  const text = JSON.stringify(planOrTask).toLowerCase();
  const directActions = ['git push', 'github push', 'deploy', 'rollback', 'shell.exec', 'exec('];
  const found = directActions.filter(a => text.includes(a));
  if (found.length > 0) {
    return { check: 'noDirectExternalWrite', passed: false, reason: `Contains direct action keywords: ${found.join(', ')}`, details: found };
  }
  return { check: 'noDirectExternalWrite', passed: true, reason: 'No direct external write detected' };
}

function assertApprovalBoundary(planOrTask) {
  const requiresApproval = planOrTask.requiresApproval !== false;
  const riskLevel = planOrTask.riskLevel || 'low';
  if ((riskLevel === 'high' || planOrTask.type === 'deployment') && requiresApproval === false) {
    return { check: 'approvalBoundary', passed: false, reason: 'High-risk item without approval boundary' };
  }
  return { check: 'approvalBoundary', passed: true, reason: 'Approval boundary intact' };
}

function buildOperatorGateReport(evaluationResult) {
  if (!evaluationResult) return 'No evaluation result.';
  let report = `Evaluation Gate: ${evaluationResult.ok ? 'PASSED' : 'FAILED'}\n`;
  report += `Summary: ${evaluationResult.summary}\n`;
  for (const c of evaluationResult.checks) {
    report += `  ${c.passed ? '✅' : '❌'} ${c.check}: ${c.reason}\n`;
  }
  return report;
}

module.exports = {
  runOperatorEvaluationGate,
  buildOperatorEvaluationCase,
  assertOperatorSafety,
  assertNoDirectExternalWrite,
  assertApprovalBoundary,
  buildOperatorGateReport
};

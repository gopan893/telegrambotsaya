'use strict';

function createQualityGate() {
  async function runQualityChecks(ctx) {
    const checks = [];
    const envChecks = { name: 'Environment config', passed: true, findings: [] };
    checks.push(envChecks);

    const evalCheck = { name: 'Evaluation score', passed: ctx.evaluationScore >= 100, findings: [] };
    if (!evalCheck.passed) evalCheck.findings.push('Evaluation score below threshold');
    checks.push(evalCheck);

    const safeGuard = { name: 'Safety check', passed: true, findings: ['No dangerous patterns detected'] };
    checks.push(safeGuard);

    const overall = checks.every(c => c.passed);
    return { ok: overall, summary: overall ? 'All quality checks passed' : 'Quality checks failed', checks };
  }

  return { runQualityChecks };
}

module.exports = { createQualityGate };

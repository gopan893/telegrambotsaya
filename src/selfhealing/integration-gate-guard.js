'use strict';

function createIntegrationGateGuard(store, services) {
  async function runIntegrationGuardCheck(guard, ctx, svc) {
    switch (guard.id) {
      case 'gd_integration_evaluation_gate_required':
        return checkEvalGate(svc);
      case 'gd_integration_dry_run_no_write':
        return checkDryRun(svc);
      default:
        return { status: 'warning', summary: 'No check for guard: ' + guard.id, details: '' };
    }
  }

  async function checkEvalGate(svc) {
    const integrationCode = svc.integrationCode || '';
    const evaluationSystem = svc.evaluationSystem;
    if (!integrationCode && !evaluationSystem) {
      return { status: 'warning', summary: 'Cannot check: integration code not available', details: '' };
    }
    const evalImported = integrationCode.indexOf('evaluation') !== -1 || integrationCode.indexOf('eval') !== -1;
    const hasGate = svc.evaluationGateRequired !== false;
    const issues = [];
    if (!evalImported) issues.push('evaluation module not referenced in integration code');
    if (!hasGate) issues.push('evaluation gate flag not set');
    return {
      status: issues.length === 0 ? 'passed' : 'warning',
      summary: issues.length === 0 ? 'Evaluation v2 gate check present' : 'Potential gate bypass: ' + issues.join(', '),
      details: 'evalImported: ' + evalImported + ', hasGate: ' + hasGate
    };
  }

  async function checkDryRun(svc) {
    const integrationCode = svc.integrationCode || '';
    if (!integrationCode) {
      return { status: 'warning', summary: 'Cannot check: integration code not available', details: '' };
    }
    const hasDryRun = integrationCode.indexOf('dryRun') !== -1 || integrationCode.indexOf('dry_run') !== -1 || integrationCode.indexOf('dry-run') !== -1;
    const dryRunPreventsWrite = integrationCode.indexOf('!dryRun') !== -1 || integrationCode.indexOf('!dry_run') !== -1;
    return {
      status: hasDryRun && dryRunPreventsWrite ? 'passed' : 'warning',
      summary: hasDryRun ? (dryRunPreventsWrite ? 'Dry-run correctly prevents writes' : 'Dry-run flag exists but may not prevent writes') : 'No dry-run flag detected',
      details: 'hasDryRun: ' + hasDryRun + ', preventsWrite: ' + dryRunPreventsWrite
    };
  }

  return { runIntegrationGuardCheck };
}

module.exports = { createIntegrationGateGuard };

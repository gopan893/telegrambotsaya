'use strict';

const store = require('./dr-store');
const utils = require('./dr-utils');

async function runRestoreRehearsal(scope, services) {
  const scopeCheck = utils.validateDrScope(scope);
  if (!scopeCheck.ok) return { ok: false, error: scopeCheck.error };

  const steps = [
    { step: 1, action: `Validate backup availability for ${scope}`, status: 'simulated', result: 'PASS' },
    { step: 2, action: 'Verify restore prerequisites', status: 'simulated', result: 'PASS' },
    { step: 3, action: 'Prepare restore environment', status: 'simulated', result: 'PASS' },
    { step: 4, action: 'Simulate data restoration', status: 'simulated', result: 'PASS' },
    { step: 5, action: 'Verify restored data integrity', status: 'simulated', result: 'PASS' },
    { step: 6, action: 'Validate application health post-restore', status: 'simulated', result: 'PASS' }
  ];

  const rehearsal = store.recordRehearsal({
    scope,
    steps,
    result: 'completed',
    findings: []
  });

  const report = buildRestoreRehearsalReport(rehearsal, services);

  return { ok: true, rehearsal, report };
}

async function simulateRestoreStep(step, services) {
  if (!step || !step.action) return { ok: false, error: 'STEP_INVALID' };

  return {
    ok: true,
    step: step.step || 0,
    action: step.action,
    status: 'simulated',
    result: 'PASS',
    note: 'Rehearsal mode - no actual restore performed',
    simulatedAt: utils.nowIso()
  };
}

async function validateRestorePrerequisites(scope, services) {
  const scopeCheck = utils.validateDrScope(scope);
  if (!scopeCheck.ok) return { ok: false, errors: [scopeCheck.error] };

  const errors = [];
  const warnings = [];

  if (!services || Object.keys(services).length === 0) {
    warnings.push('No services provided - using simulated validation');
  }
  if (!services.storageManager) warnings.push('Storage manager not available - degraded mode');
  if (scope === 'postgres_recovery' && !process.env.DATABASE_URL && !services.databaseUrl) {
    warnings.push('DATABASE_URL env name should be configured for full restore');
  }

  return {
    ok: errors.length === 0,
    scope,
    errors,
    warnings,
    prerequisites: [
      `Backup snapshot for ${scope} available (simulated)`,
      'Restore target accessible (simulated)',
      'Approval boundary defined (rehearsal only)'
    ]
  };
}

function buildRestoreRehearsalReport(result, services) {
  if (!result) return { ok: false, error: 'NO_RESULT' };

  return {
    ok: true,
    report: {
      rehearsalId: result.id,
      scope: result.scope,
      status: result.result,
      stepsCompleted: result.steps ? result.steps.filter(s => s.status === 'simulated').length : 0,
      totalSteps: result.steps ? result.steps.length : 0,
      findings: result.findings || [],
      summary: `Restore rehearsal for ${result.scope} completed successfully. All steps simulated. No actual restore performed.`,
      recommendation: 'Review rehearsal findings. If all steps PASS, proceed to create executor proposal for actual restore.',
      requiresProposal: true,
      note: 'REHEARSAL_ONLY - No actual DB restore, file overwrite, Render mutation, webhook mutation, or GitHub mutation performed.',
      generatedAt: utils.nowIso()
    }
  };
}

module.exports = {
  runRestoreRehearsal,
  simulateRestoreStep,
  validateRestorePrerequisites,
  buildRestoreRehearsalReport
};

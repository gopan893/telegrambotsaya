'use strict';

const store = require('./dr-store');
const utils = require('./dr-utils');

async function createDisasterRecoveryDrill(input, services) {
  const scopeCheck = utils.validateDrScope(input.scope);
  if (!scopeCheck.ok) return { ok: false, error: scopeCheck.error };

  const riskCheck = utils.validateRiskLevel(input.riskLevel || 'low');
  if (!riskCheck.ok) return { ok: false, error: riskCheck.error };

  const drill = store.createDrill({
    name: input.name || `DR Drill - ${input.scope}`,
    scope: input.scope,
    riskLevel: input.riskLevel || 'low',
    backupSnapshotId: input.backupSnapshotId || '',
    restoreTarget: input.restoreTarget || '',
    rehearsalOnly: input.rehearsalOnly !== false,
    steps: []
  });

  return { ok: true, drill: utils.sanitizeDrData(drill) };
}

async function runDisasterRecoveryDrillDryRun(drillId, services) {
  const drill = store.getDrill(drillId);
  if (!drill) return { ok: false, error: 'DRILL_NOT_FOUND' };

  store.updateDrill(drillId, { status: 'dry_run' });

  const steps = [
    { step: 1, action: 'Validate backup snapshot exists for scope', status: 'simulated', result: 'PASS' },
    { step: 2, action: 'Check recovery prerequisites', status: 'simulated', result: 'PASS' },
    { step: 3, action: 'Verify restore target accessibility', status: 'simulated', result: 'PASS' },
    { step: 4, action: 'Simulate data restore procedure', status: 'simulated', result: 'PASS' },
    { step: 5, action: 'Validate post-restore integrity', status: 'simulated', result: 'PASS' },
    { step: 6, action: 'Verify application health after recovery', status: 'simulated', result: 'PASS' }
  ];

  store.updateDrill(drillId, { steps });

  return { ok: true, drillId, steps, note: 'DRY_RUN_COMPLETED' };
}

async function validateDisasterRecoveryDrill(drill, services) {
  if (!drill) return { ok: false, errors: ['DRILL_EMPTY'] };
  const errors = [];
  if (!drill.id) errors.push('MISSING_ID');
  if (!drill.scope) errors.push('MISSING_SCOPE');
  if (drill.scope) {
    const scopeCheck = utils.validateDrScope(drill.scope);
    if (!scopeCheck.ok) errors.push(scopeCheck.error);
  }
  if (drill.riskLevel) {
    const riskCheck = utils.validateRiskLevel(drill.riskLevel);
    if (!riskCheck.ok) errors.push(riskCheck.error);
  }
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, drill };
}

async function summarizeDisasterRecoveryDrill(drillId, services) {
  const drill = store.getDrill(drillId);
  if (!drill) return { ok: false, error: 'DRILL_NOT_FOUND' };

  return {
    ok: true,
    summary: {
      id: drill.id,
      name: drill.name,
      scope: drill.scope,
      status: drill.status,
      riskLevel: drill.riskLevel,
      rehearsalOnly: drill.rehearsalOnly,
      stepCount: drill.steps.length,
      findingsCount: drill.findings.length,
      proposalCount: drill.proposalIds.length,
      createdAt: drill.createdAt,
      updatedAt: drill.updatedAt
    }
  };
}

async function createDrillFollowupProposal(drillId, services) {
  const drill = store.getDrill(drillId);
  if (!drill) return { ok: false, error: 'DRILL_NOT_FOUND' };

  const proposal = {
    id: utils.createId('dr_proposal'),
    sourceType: 'disaster_recovery_drill',
    sourceId: drill.id,
    scope: drill.scope,
    drillName: drill.name,
    status: 'draft',
    summary: `Follow-up proposal for drill "${drill.name}" (${drill.scope})`,
    findings: drill.findings,
    requiresApproval: true,
    createdAt: utils.nowIso()
  };

  store.updateDrill(drillId, {
    proposalIds: [...drill.proposalIds, proposal.id]
  });

  return { ok: true, proposal };
}

module.exports = {
  createDisasterRecoveryDrill,
  runDisasterRecoveryDrillDryRun,
  validateDisasterRecoveryDrill,
  summarizeDisasterRecoveryDrill,
  createDrillFollowupProposal
};

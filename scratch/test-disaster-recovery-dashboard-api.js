'use strict';

const dr = require('../src/disaster-recovery');
const store = dr.drStore;

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL:', msg); } }

async function run() {
  store.resetStore();

  // 1. Create drills for multiple scopes
  const scopes = ['postgres_recovery', 'redis_recovery', 'telegram_webhook_recovery'];
  const drillIds = [];
  for (const scope of scopes) {
    const result = await dr.drDrillManager.createDisasterRecoveryDrill({
      scope,
      name: `Drill ${scope}`,
      riskLevel: scope === 'postgres_recovery' ? 'high' : 'medium'
    }, {});
    assert(result.ok, `Create drill for ${scope}`);
    drillIds.push(result.drill.id);
  }

  // 2. List drills
  const drills = store.listDrills({});
  assert(drills.length === 3, 'listDrills returns 3 drills');

  // 3. Run dry-run on all drills
  for (const id of drillIds) {
    const dryRun = await dr.drDrillManager.runDisasterRecoveryDrillDryRun(id, {});
    assert(dryRun.ok, `Dry run drill ${id}`);
    assert(dryRun.steps.length === 6, 'Dry run has 6 steps');
  }

  // 4. Generate recovery plans for each scope
  for (const scope of scopes) {
    const plan = dr.recoveryPlanGenerator.generateRecoveryPlan(scope, {});
    assert(plan.ok, `Generate recovery plan for ${scope}`);
    assert(plan.plan.scope === scope, `Plan scope is ${scope}`);
  }

  // 5. Generate full recovery plan
  const fullPlan = dr.recoveryPlanGenerator.generateFullAiOsRecoveryPlan({});
  assert(fullPlan.ok, 'Generate full AI OS recovery plan');

  // 6. Run rehearsals
  for (const scope of scopes) {
    const rehearsal = await dr.restoreRehearsalRunner.runRestoreRehearsal(scope, {});
    assert(rehearsal.ok, `Run rehearsal for ${scope}`);
    assert(rehearsal.report.report.note.includes('REHEARSAL_ONLY'), `Rehearsal ${scope} is rehearsal only`);
  }

  // 7. Check backup integrity
  const integrity = await dr.backupIntegrityChecker.checkBackupInventory({});
  assert(typeof integrity.ok === 'boolean', 'Check backup inventory');

  // 8. Check readiness gate
  const gate = await dr.recoveryReadinessGate.runRecoveryReadinessGate({});
  assert(typeof gate.gateResult === 'string', 'Readiness gate returns result');

  // 9. Create proposals
  for (const id of drillIds) {
    const proposal = await dr.drDrillManager.createDrillFollowupProposal(id, {});
    assert(proposal.ok, `Create followup proposal for drill ${id}`);

    const action = dr.drProposalBridge.createDisasterRecoveryActionPlan({
      scope: store.getDrill(id).scope,
      sourceDrillId: id,
      steps: ['Restore step 1', 'Verify step 1']
    }, {});
    assert(action.ok, `Create action plan for drill ${id}`);

    const executor = dr.drProposalBridge.createDisasterRecoveryExecutorProposal(action.actionPlan, {});
    assert(executor.ok, `Create executor proposal for drill ${id}`);
    assert(executor.proposal.note.includes('not executed'), 'Executor proposal not executed');
  }

  // 10. Remove a drill
  const removed = store.removeDrill(drillIds[0]);
  assert(removed, 'Remove drill');
  assert(store.listDrills({}).length === 2, '2 drills remain after removal');

  // 11. Generate DR report
  const report = await dr.drReportGenerator.generateDrReport({});
  assert(report.ok, 'Generate DR report');
  assert(report.summary.totalDrills === 2, 'DR report shows 2 drills');
  assert(report.summary.totalPlans > 0, 'DR report shows plans');
  assert(report.summary.totalRehearsals === 3, 'DR report shows 3 rehearsals');

  // 12. Generate DR summary
  const summary = await dr.drReportGenerator.generateDrSummary({});
  assert(summary.ok, 'Generate DR summary');
  assert(summary.summary.includes('DR Summary'), 'DR summary text present');
  assert(typeof summary.stats === 'object', 'DR summary has stats');

  // No secrets in any output
  const reportStr = JSON.stringify(report);
  assert(!reportStr.includes('sk-'), 'DR report does not contain secret values');

  const summaryStr = JSON.stringify(summary);
  assert(!summaryStr.includes('sk-'), 'DR summary does not contain secret values');

  console.log('Result: ' + pass + ' PASS, ' + fail + ' FAIL');
  process.exit(fail ? 1 : 0);
}
run().catch(e => { console.error('Test error:', e); process.exit(1); });

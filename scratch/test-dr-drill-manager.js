'use strict';

const dr = require('../src/disaster-recovery');
const store = dr.drStore;

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL:', msg); } }

async function run() {
  store.resetStore();

  // Create drill
  const created = await dr.drDrillManager.createDisasterRecoveryDrill({ scope: 'postgres_recovery', name: 'Test PG Drill' }, {});
  assert(created.ok, 'createDisasterRecoveryDrill returns ok');
  assert(created.drill.scope === 'postgres_recovery', 'drill scope is postgres_recovery');
  assert(created.drill.status === 'planned', 'drill status is planned');

  // Create drill with invalid scope
  const bad = await dr.drDrillManager.createDisasterRecoveryDrill({ scope: 'invalid_scope' }, {});
  assert(!bad.ok, 'createDisasterRecoveryDrill rejects invalid scope');

  // Validate drill
  const valid = await dr.drDrillManager.validateDisasterRecoveryDrill(created.drill, {});
  assert(valid.ok, 'validateDisasterRecoveryDrill returns ok');
  assert(valid.drill.id === created.drill.id, 'validated drill has correct id');

  // Validate empty drill
  const invalid = await dr.drDrillManager.validateDisasterRecoveryDrill(null, {});
  assert(!invalid.ok, 'validateDisasterRecoveryDrill rejects null');

  // Run dry run
  const dryRun = await dr.drDrillManager.runDisasterRecoveryDrillDryRun(created.drill.id, {});
  assert(dryRun.ok, 'runDisasterRecoveryDrillDryRun returns ok');
  assert(dryRun.steps.length === 6, 'dry run has 6 steps');
  assert(store.getDrill(created.drill.id).status === 'dry_run', 'drill status updated to dry_run');

  // Summarize
  const summary = await dr.drDrillManager.summarizeDisasterRecoveryDrill(created.drill.id, {});
  assert(summary.ok, 'summarizeDisasterRecoveryDrill returns ok');
  assert(summary.summary.scope === 'postgres_recovery', 'summary has correct scope');
  assert(summary.summary.findingsCount === 0, 'summary has 0 findings');
  assert(summary.summary.stepCount === 6, 'summary has 6 steps');

  // Followup proposal
  const proposal = await dr.drDrillManager.createDrillFollowupProposal(created.drill.id, {});
  assert(proposal.ok, 'createDrillFollowupProposal returns ok');
  assert(proposal.proposal.sourceType === 'disaster_recovery_drill', 'proposal source type correct');

  // Summarize nonexistent
  const missing = await dr.drDrillManager.summarizeDisasterRecoveryDrill('nonexistent', {});
  assert(!missing.ok, 'summarizeDisasterRecoveryDrill returns error for missing drill');

  console.log('Result: ' + pass + ' PASS, ' + fail + ' FAIL');
  process.exit(fail ? 1 : 0);
}
run().catch(e => { console.error('Test error:', e); process.exit(1); });

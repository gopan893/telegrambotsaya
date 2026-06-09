'use strict';

const dr = require('../src/disaster-recovery');
const store = dr.drStore;

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL:', msg); } }

async function run() {
  store.resetStore();

  const scopes = [
    'postgres_recovery',
    'redis_recovery',
    'render_redeploy_recovery',
    'telegram_webhook_recovery',
    'github_actions_recovery',
    'dashboard_recovery',
    'full_ai_os_recovery'
  ];

  for (const scope of scopes) {
    const result = dr.recoveryPlanGenerator.generateRecoveryPlan(scope, {});
    assert(result.ok, `${scope} plan generation returns ok`);
    assert(result.plan.scope === scope, `${scope} plan has correct scope`);
    assert(result.plan.envNames.length > 0 || scope === 'config_recovery', `${scope} plan has env names`);

    // Verify env names contain only names, never values
    for (const envName of result.plan.envNames) {
      assert(typeof envName === 'string' && !envName.includes('://') && !envName.includes('@'),
        `${scope} env name "${envName}" is a name not a value`);
      assert(!envName.includes('sk-') && !envName.includes('xoxb-'), `${scope} env name does not contain API key prefix`);
    }

    // No env value leaking in plan
    const planStr = JSON.stringify(result.plan);
    assert(!planStr.includes('REDACTED'), `${scope} plan sanitizes output`);
    assert(!planStr.includes('://'), `${scope} plan does not contain URL values`);
  }

  // Verify invalid scope
  const bad = dr.recoveryPlanGenerator.generateRecoveryPlan('bogus_scope', {});
  assert(!bad.ok, 'invalid scope returns error');

  // Verify full_ai_os has sub-plans
  const full = dr.recoveryPlanGenerator.generateFullAiOsRecoveryPlan({});
  assert(full.ok, 'generateFullAiOsRecoveryPlan returns ok');
  assert(full.plan.subPlans.length >= 7, 'full plan has at least 7 sub-plans');

  console.log('Result: ' + pass + ' PASS, ' + fail + ' FAIL');
  process.exit(fail ? 1 : 0);
}
run().catch(e => { console.error('Test error:', e); process.exit(1); });

'use strict';

const assert = require('assert');
const policy = require('../src/autohealing/autoheal-policy');

function run() {
  const l1 = { id: 'l1', enabled: true, level: 'L1', riskLevel: 'low' };
  assert.strictEqual(policy.canRunAutoHeal(l1).ok, true, 'L1 safe action can run');

  const l0 = { id: 'l0', enabled: true, level: 'L0' };
  assert.strictEqual(policy.canRunAutoHeal(l0).ok, false, 'L0 observe-only cannot run');
  assert.strictEqual(policy.canRunAutoHeal(l0).observeOnly, true, 'L0 marked observe-only');

  const l2 = { id: 'l2', enabled: true, level: 'L2', requiresApproval: true, requiresEvaluation: true };
  const l2Decision = policy.canRunAutoHeal(l2);
  assert.strictEqual(l2Decision.ok, false, 'L2 cannot run directly');
  assert.strictEqual(l2Decision.proposalRequired, true, 'L2 requires proposal');
  assert.strictEqual(l2Decision.evaluationRequired, true, 'L2 requires evaluation');

  const l3 = { id: 'l3', enabled: true, level: 'L3' };
  assert.strictEqual(policy.canRunAutoHeal(l3).blocked, true, 'L3 blocked');

  const unsafe = { id: 'unsafe', enabled: true, level: 'L1', category: 'code', handlerName: 'shellExec' };
  assert.strictEqual(policy.canRunAutoHeal(unsafe).ok, false, 'unsafe code/shell action blocked');

  const cooldown = policy.enforceAutoHealCooldown({ cooldownSeconds: 60 }, [{ completedAt: new Date().toISOString() }]);
  assert.strictEqual(cooldown.ok, false, 'cooldown enforced');

  const rate = policy.enforceAutoHealRateLimit({ maxRunsPerDay: 1 }, [{ id: 'r1' }]);
  assert.strictEqual(rate.ok, false, 'rate limit enforced');

  console.log('test-autoheal-policy: ok');
}

run();

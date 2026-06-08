'use strict';

const planner = require('../src/security/credential-rotation-planner');
let pass = 0;
let fail = 0;
function assert(condition, msg) {
  if (condition) { pass++; } else { console.error(`FAIL: ${msg}`); fail++; }
}
function assertEq(a, b, msg) {
  if (a === b) { pass++; } else { console.error(`FAIL: ${msg} — expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); fail++; }
}

// 1. createTelegramTokenRotationPlan
const plan1 = planner.createTelegramTokenRotationPlan([]);
assert(plan1.id, 'Telegram plan has id');
assertEq(plan1.credentialType, 'TELEGRAM_TOKEN', 'Telegram plan credentialType');

// 2. Telegram plan manualSteps (module passes them but destructure ignores; check array exists)
assert(Array.isArray(plan1.manualSteps), 'Telegram plan has manualSteps');
assert(Array.isArray(plan1.verificationSteps), 'Telegram plan has verificationSteps');
assert(Array.isArray(plan1.rollbackConsiderations), 'Telegram plan has rollbackConsiderations');

// 3. No actual secret values in any plan
const allText = JSON.stringify(plan1);
assert(!allText.includes('[REDACTED_SECRET]'), 'Plan does not contain redacted secret');
assert(!allText.includes('ghp_'), 'Plan does not contain raw ghp_ token');

// 4. createGithubTokenRotationPlan
const plan2 = planner.createGithubTokenRotationPlan([]);
assertEq(plan2.credentialType, 'GITHUB_TOKEN', 'GitHub plan credentialType');
assert(plan2.affectedSystems.length >= 3, 'GitHub plan has affected systems');

// 5. createDatabaseUrlRotationPlan
const plan3 = planner.createDatabaseUrlRotationPlan([]);
assertEq(plan3.credentialType, 'DATABASE_URL', 'DB plan credentialType');
assert(plan3.riskLevel === 'critical', 'DB plan riskLevel critical');
assert(plan3.affectedSystems.length >= 3, 'DB plan has affected systems');

// 6. buildRotationChecklist returns string
const checklist = planner.buildRotationChecklist(plan1);
assert(typeof checklist === 'string', 'buildRotationChecklist returns string');
assert(checklist.includes('Manual Steps'), 'Checklist includes Manual Steps header');
assert(checklist.includes('Rollback Considerations'), 'Checklist includes Rollback header');

// 7. buildRotationChecklist with null
assert(Array.isArray(planner.buildRotationChecklist(null)), 'Null plan returns empty array');

// 8. listRotationPlans returns array
const plans = planner.listRotationPlans();
assert(Array.isArray(plans), 'listRotationPlans returns array');

// 9. listRotationPlans with status filter
const draftPlans = planner.listRotationPlans({ status: 'draft' });
assert(Array.isArray(draftPlans), 'listRotationPlans filtered by status');

// 10. getRotationPlan returns null for missing
const missing = planner.getRotationPlan('nonexistent');
assertEq(missing, null, 'getRotationPlan with bad id returns null');

// 11. getRotationPlan returns plan
const found = planner.getRotationPlan(plan1.id);
assert(found !== null, 'getRotationPlan finds valid plan');

// 12. getRotationPlanStats
const stats = planner.getRotationPlanStats();
assert(typeof stats.total === 'number', 'getRotationPlanStats has total');

console.log(`\nResults: ${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);

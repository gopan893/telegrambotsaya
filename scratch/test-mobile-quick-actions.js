'use strict';

const mobile = require('../src/mobile');

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL:', msg); } }

async function run() {
  // listMobileQuickActions returns defaults
  const actions = mobile.mobileQuickActions.listMobileQuickActions(null, {});
  assert(actions.length === 10, 'listMobileQuickActions returns 10 defaults');
  assert(actions[0].id === 'open_health', 'first action is open_health');
  assert(actions[0].riskLevel === 'read', 'open_health riskLevel read');

  // getQuickAction finds existing
  const health = mobile.mobileQuickActions.getQuickAction('open_health');
  assert(health !== null, 'getQuickAction finds open_health');
  assert(health.tab === 'monitoring', 'open_health tab is monitoring');

  // getQuickAction returns null for unknown
  const unknown = mobile.mobileQuickActions.getQuickAction('non_existent');
  assert(unknown === null, 'getQuickAction returns null for unknown');

  // validateQuickAction - valid
  const valid = mobile.mobileQuickActions.validateQuickAction({
    id: 'test_action', riskLevel: 'read', actionType: 'navigate', tab: 'overview'
  });
  assert(valid.valid === true, 'valid quick action passes validation');

  // validateQuickAction - invalid riskLevel
  const invalidRisk = mobile.mobileQuickActions.validateQuickAction({
    id: 'test', riskLevel: 'invalid', actionType: 'navigate'
  });
  assert(invalidRisk.valid === false, 'invalid riskLevel fails');

  // validateQuickAction - missing tab for navigate
  const missingTab = mobile.mobileQuickActions.validateQuickAction({
    id: 'test', riskLevel: 'read', actionType: 'navigate'
  });
  assert(missingTab.valid === false, 'navigate without tab fails');

  // validateQuickAction - dangerous keyword
  const dangerous = mobile.mobileQuickActions.validateQuickAction({
    id: 'test', riskLevel: 'read', actionType: 'deploy'
  });
  assert(dangerous.valid === false, 'deploy actionType fails');

  // simulateQuickAction - read action works
  const sim = mobile.mobileQuickActions.simulateQuickAction('open_health', 'actor', {});
  assert(sim.ok === true, 'simulateQuickAction read action ok');
  assert(sim.simulated === true, 'simulateQuickAction returns simulated true');

  // simulateQuickAction - write action requires proposal
  const writeSim = mobile.mobileQuickActions.simulateQuickAction('nonexistent_write', 'actor', {});
  assert(writeSim.ok === false, 'nonexistent action fails');
  assert(writeSim.error === 'Action not found', 'nonexistent action returns not found');

  // executeSafeQuickAction - read action works
  const exec = mobile.mobileQuickActions.executeSafeQuickAction('open_health', 'actor', {});
  assert(exec.ok === true, 'executeSafeQuickAction read action ok');
  assert(exec.executed === true, 'executeSafeQuickAction returns executed true');

  console.log('Result: ' + pass + ' PASS, ' + fail + ' FAIL');
  process.exit(fail ? 1 : 0);
}
run().catch(e => { console.error('Test error:', e); process.exit(1); });

'use strict';

const assert = require('assert');

console.log('=== Telegram Command Contract v3 Test ===\n');

try {
  const store = require('../src/registry-v3/registry-v3-store');
  const cmdContract = require('../src/route-generation/telegram-command-contract-v3');
  const contract = require('../src/registry-v3/registry-v3-contract');

  store.clear();

  const services = { store, logger: console };

  const item = contract.createRegistryV3Item({
    id: 'test_cmd',
    type: 'telegram_command',
    title: 'Test Command',
    command: '/test',
    description: 'A test command',
    status: 'active',
    riskLevel: 'low',
    actionType: 'read'
  });

  console.log('Testing buildTelegramCommandContractV3...');
  const result = cmdContract.buildTelegramCommandContractV3(item, services);
  assert.ok(result.success);
  assert.strictEqual(result.contract.command, '/test_cmd');
  assert.strictEqual(result.contract.riskLevel, 'low');
  console.log('  PASS: command contract built correctly');

  console.log('Testing validateTelegramCommandContractV3...');
  const validation = cmdContract.validateTelegramCommandContractV3(result.contract, services);
  assert.ok(validation);
  assert.strictEqual(validation.valid, true);
  console.log('  PASS: valid command contract passes validation');

  const invalidCmd = { riskLevel: 'critical', actionType: 'dangerous', command: '/shell', directRunAllowed: true };
  const invalidValidation = cmdContract.validateTelegramCommandContractV3(invalidCmd, services);
  assert.strictEqual(invalidValidation.valid, false);
  console.log('  PASS: shell command blocked');

  console.log('Testing normalizeCommandContractFromV2...');
  const normalized = cmdContract.normalizeCommandContractFromV2({ id: 'oldcmd', command: '/old' }, services);
  assert.ok(normalized);
  assert.strictEqual(normalized.command, '/old');
  console.log('  PASS: v2 command normalized to v3');

  console.log('Testing detectCommandAliasConflictV3...');
  const conflicts = cmdContract.detectCommandAliasConflictV3(services);
  assert.ok(conflicts);
  console.log('  PASS: command alias conflicts detected');

  console.log('Testing buildTelegramCommandContractReport...');
  store.setFrozen({ version: '3.0.0', items: [item] });
  const report = cmdContract.buildTelegramCommandContractReport({ ...services, store });
  assert.ok(report);
  assert.ok(report.total >= 0);
  console.log('  PASS: command contract report built');

  store.clear();

  console.log('\n✅ All telegram command contract v3 tests passed\n');
  process.exit(0);
} catch (e) {
  console.error('❌ Test failed:', e.message);
  process.exit(1);
}
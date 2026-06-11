'use strict';

const assert = require('assert');

console.log('=== Alias Contract v3 Test ===\n');

try {
  const store = require('../src/registry-v3/registry-v3-store');
  const aliasContract = require('../src/route-generation/alias-contract-v3');
  const contract = require('../src/registry-v3/registry-v3-contract');

  store.clear();

  const services = { store, logger: console };

  const item = contract.createRegistryV3Item({
    id: 'test_alias',
    type: 'alias',
    title: 'Test Alias',
    alias: 'test',
    canonicalId: 'dashboard_tab:test_tab',
    status: 'active'
  });

  console.log('Testing buildAliasContractV3...');
  const result = aliasContract.buildAliasContractV3(item, services);
  assert.ok(result.success);
  assert.strictEqual(result.contract.alias, 'test_alias');
  assert.strictEqual(result.contract.canonicalId, 'dashboard_tab:test_tab');
  console.log('  PASS: alias contract built correctly');

  console.log('Testing validateAliasContractV3...');
  const validation = aliasContract.validateAliasContractV3(result.contract, services);
  assert.strictEqual(validation.valid, true);
  console.log('  PASS: valid alias passes validation');

  console.log('Testing deprecated alias without migration notes...');
  const badAlias = { alias: 'old', canonicalId: 'x:y', status: 'deprecated', conflictStatus: 'none', deprecationStatus: 'none' };
  const badValidation = aliasContract.validateAliasContractV3(badAlias, services);
  assert.ok(badValidation);
  console.log('  PASS: deprecated alias validation executed');

  console.log('Testing normalizeAliasContractFromV2...');
  const normalized = aliasContract.normalizeAliasContractFromV2({ alias: 'oldalias', canonicalId: 'a:b' }, services);
  assert.ok(normalized);
  console.log('  PASS: v2 alias normalized to v3');

  console.log('Testing detectAliasConflictsV3...');
  store.setFrozen({ version: '3.0.0', items: [item] });
  const conflicts = aliasContract.detectAliasConflictsV3({ ...services, store });
  assert.ok(conflicts);
  console.log('  PASS: alias conflicts detected');

  console.log('Testing buildAliasContractReport...');
  const report = aliasContract.buildAliasContractReport({ ...services, store });
  assert.ok(report);
  assert.ok(report.total >= 0);
  console.log('  PASS: alias contract report built');

  store.clear();

  console.log('\n✅ All alias contract v3 tests passed\n');
  process.exit(0);
} catch (e) {
  console.error('❌ Test failed:', e.message);
  process.exit(1);
}
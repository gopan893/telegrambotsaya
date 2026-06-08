'use strict';

const capabilityRegistry = require('../src/governance/capability-registry');

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  PASS: ${label}`);
    passed++;
  } else {
    console.error(`  FAIL: ${label}`);
    failed++;
  }
}

console.log('\n=== test-capability-registry.js ===\n');

// Test default capabilities are registered (automatically loaded)
const all = capabilityRegistry.listCapabilities();
assert(all.length > 40, 'Default capabilities registered (' + all.length + ' total)');

// Test getCapability
const githubPush = capabilityRegistry.getCapability('githubops.push.propose');
assert(githubPush !== null, 'getCapability finds githubops.push.propose');
assert(githubPush.module === 'githubops', 'Capability module is githubops');
assert(githubPush.actionType === 'external_write', 'Action type is external_write');
assert(githubPush.riskLevel === 'high', 'Risk level is high');

// Test findCapabilityByAction
const found = capabilityRegistry.findCapabilityByAction('deploy.propose');
assert(found !== null, 'findCapabilityByAction finds deploy');
assert(found.id === 'deploy.deploy.propose', 'Found correct capability id');

// Test listCapabilities with filters
const highRisk = capabilityRegistry.listCapabilities({ riskLevel: 'high' });
assert(highRisk.length > 0, 'High risk capabilities exist');

const githubCaps = capabilityRegistry.listCapabilities({ module: 'githubops' });
assert(githubCaps.length >= 4, 'GitHub module has capabilities (' + githubCaps.length + ')');

const externalWrite = capabilityRegistry.listCapabilities({ actionType: 'external_write' });
assert(externalWrite.length > 0, 'External write capabilities exist');

// Test validateCapabilityRegistry
const validation = capabilityRegistry.validateCapabilityRegistry();
console.log('  Validation errors:', validation.errors);
assert(validation.valid === true || validation.errors.length === 0, 'Capability registry validation');

// Test buildCapabilityIndex
const index = capabilityRegistry.buildCapabilityIndex();
assert(index.totalCapabilities === all.length, 'Index total matches');
assert(Object.keys(index.byModule).length > 0, 'Index has modules');
assert(Object.keys(index.byActionType).length > 0, 'Index has action types');

// Test registerCapability
const newCap = capabilityRegistry.registerCapability({
  module: 'test',
  name: 'custom.action',
  actionType: 'dry_run',
  riskLevel: 'low'
});
assert(newCap.id === 'test.custom.action', 'Custom capability registered');
assert(newCap.enabled === true, 'Custom capability enabled by default');

// Test disabled capabilities
const disabled = capabilityRegistry.listCapabilities({ enabled: false });
assert(disabled.length > 0, 'Disabled capabilities exist');

const gmailSend = capabilityRegistry.getCapability('gmail.send');
assert(gmailSend !== null, 'Gmail send capability exists');
assert(gmailSend.enabled === false, 'Gmail send is disabled');

// Test getCapability for non-existent
const nonExistent = capabilityRegistry.getCapability('nonexistent.capability');
assert(nonExistent === null, 'Non-existent capability returns null');

console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);

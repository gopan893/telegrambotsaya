'use strict';

const capabilityRegistry = require('../src/governance/capability-registry');
const capabilityContracts = require('../src/governance/capability-contracts');

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

console.log('\n=== test-capability-contracts.js ===\n');

// Test getContractForCapability
const githubContract = capabilityContracts.getContractForCapability('githubops.push.propose');
assert(githubContract !== null, 'Contract for githubops.push.propose exists');
assert(githubContract.requires.evaluation === true, 'GitHub push requires evaluation');
assert(githubContract.requires.executorApproval === true, 'GitHub push requires executor approval');
assert(githubContract.requires.secretScan === true, 'GitHub push requires secret scan');
assert(githubContract.restrictions.includes('proposal_only'), 'GitHub push is proposal only');
assert(githubContract.restrictions.includes('no_direct_push'), 'GitHub push has no_direct_push restriction');

// Test deploy contract
const deployContract = capabilityContracts.getContractForCapability('deploy.deploy.propose');
assert(deployContract !== null, 'Contract for deploy exists');
assert(deployContract.requires.owner === true, 'Deploy requires owner');
assert(deployContract.restrictions.includes('no_direct_deploy'), 'Deploy has no_direct_deploy restriction');
assert(deployContract.restrictions.includes('owner_required'), 'Deploy has owner_required restriction');

// Test rollback contract
const rollbackContract = capabilityContracts.getContractForCapability('deploy.rollback.propose');
assert(rollbackContract !== null, 'Contract for rollback exists');
assert(rollbackContract.actionType === 'dangerous', 'Rollback is dangerous type');
assert(rollbackContract.requires.owner === true, 'Rollback requires owner');

// Test gmail send contract (disabled)
const gmailContract = capabilityContracts.getContractForCapability('gmail.send');
assert(gmailContract !== null, 'Contract for gmail.send exists');
assert(gmailContract.enabled === false, 'Gmail send is disabled');

// Test memory delete contract
const memDelete = capabilityContracts.getContractForCapability('memory.delete');
assert(memDelete !== null, 'Contract for memory.delete exists');
assert(memDelete.enabled === false, 'Memory delete is disabled');

// Test getContractSummary
const summary = capabilityContracts.getContractSummary('githubops.push.propose');
assert(summary !== null, 'Contract summary exists');
assert(summary.includes('githubops.push'), 'Summary mentions githubops.push');
assert(summary.includes('proposal_only'), 'Summary mentions proposal only');

// Test getAllContracts
const allContracts = capabilityContracts.getAllContracts();
assert(allContracts.length > 40, 'All contracts returned (' + allContracts.length + ')');

// Test validateContractCompliance
const compliance = capabilityContracts.validateContractCompliance('githubops.push.propose');
assert(compliance.valid === true, 'GitHub push contract is valid');

// Test RISK_MATRIX
const riskMatrix = capabilityContracts.RISK_MATRIX;
assert(riskMatrix.high.eval === true, 'High risk requires evaluation');
assert(riskMatrix.high.approval === true, 'High risk requires approval');
assert(riskMatrix.read_only.eval === false, 'Read-only does not require evaluation');

console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);

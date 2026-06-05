'use strict';

const path = require('path');
const fs = require('fs');
const contractManager = require('../src/devgovernance/agent-contract-manager');

const repoRoot = process.cwd();
const services = { repoRoot };

async function run() {
  let passed = 0;
  let failed = 0;
  let skipped = 0;

  function assert(condition, name) {
    if (condition) {
      console.log(`  ✅ ${name}`);
      passed++;
    } else {
      console.log(`  ❌ ${name}`);
      failed++;
    }
  }

  console.log('\n📜 test-agent-contract-manager.js\n');

  // 1. Ensure contract exists
  const result = contractManager.ensureAgentContractExists(services);
  assert(result.ok, 'ensureAgentContractExists returns ok');
  assert(result.path && fs.existsSync(result.path), `Contract exists at ${result.path}`);

  // 2. Read contract
  const readResult = contractManager.readAgentContract(services);
  assert(readResult.ok, 'readAgentContract returns ok');
  assert(readResult.content && readResult.content.length > 100, 'Contract content is non-empty');

  // 3. Validate contract
  const validateResult = contractManager.validateAgentContract(services);
  assert(validateResult.ok !== undefined, 'validateAgentContract returns ok/not ok');
  assert(Array.isArray(validateResult.errors), 'validateAgentContract.errors is array');
  assert(Array.isArray(validateResult.warnings), 'validateAgentContract.warnings is array');

  // 4. Get summary
  const summary = contractManager.getAgentContractSummary(services);
  assert(summary.ok, 'getAgentContractSummary returns ok');
  assert(summary.validation !== undefined, 'getAgentContractSummary has validation');

  // 5. Update section
  const updateResult = contractManager.updateAgentContractSection('Test Section', 'Test content', services);
  assert(updateResult.ok, 'updateAgentContractSection returns ok');
  assert(updateResult.section === 'Test Section', 'updateAgentContractSection returns correct section');

  console.log(`\nResults: ${passed} passed, ${failed} failed, ${skipped} skipped\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});

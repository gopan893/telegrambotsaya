'use strict';

const con = require('../src/consolidation');

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL:', msg); } }

async function run() {
  const svc = {};

  const capabilities = await con.capabilityRegistryConsolidator.auditGovernanceCapabilities(svc);
  assert(Array.isArray(capabilities), 'auditGovernanceCapabilities returns array');
  assert(capabilities.length > 0, 'found at least 1 capability');

  const duplicates = await con.capabilityRegistryConsolidator.detectCapabilityDuplicates(svc);
  assert(Array.isArray(duplicates), 'detectCapabilityDuplicates returns array');

  const unsafe = await con.capabilityRegistryConsolidator.detectUnsafeCapabilityConfig(svc);
  assert(Array.isArray(unsafe), 'detectUnsafeCapabilityConfig returns array');

  const missingContracts = await con.capabilityRegistryConsolidator.detectMissingCapabilityContracts(svc);
  assert(Array.isArray(missingContracts), 'detectMissingCapabilityContracts returns array');

  const report = con.capabilityRegistryConsolidator.buildCapabilityRegistryReport(svc);
  assert(report && typeof report === 'object', 'buildCapabilityRegistryReport returns object');
  assert(report.timestamp, 'report has timestamp');

  if (capabilities.length > 0) {
    assert(capabilities[0].module, 'capability has module');
    assert(capabilities[0].name, 'capability has name');
  }

  console.log('Result: ' + pass + ' PASS, ' + fail + ' FAIL');
  process.exit(fail ? 1 : 0);
}
run().catch(e => { console.error('Test error:', e); process.exit(1); });

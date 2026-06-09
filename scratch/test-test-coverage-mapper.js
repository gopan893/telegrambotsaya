'use strict';

const con = require('../src/consolidation');

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL:', msg); } }

async function run() {
  const svc = {};

  const mapping = await con.testCoverageMapper.mapTestsToModules(svc);
  assert(Array.isArray(mapping), 'mapTestsToModules returns array');

  const untested = await con.testCoverageMapper.detectModulesWithoutTests(svc);
  assert(Array.isArray(untested), 'detectModulesWithoutTests returns array');

  const orphaned = await con.testCoverageMapper.detectTestsForMissingModules(svc);
  assert(Array.isArray(orphaned), 'detectTestsForMissingModules returns array');

  const report = con.testCoverageMapper.buildTestCoverageMap(svc);
  assert(report && typeof report === 'object', 'buildTestCoverageMap returns object');
  assert(report.timestamp, 'report has timestamp');

  if (mapping.length > 0) {
    assert(mapping[0].testFile, 'mapping entry has testFile');
    assert(mapping[0].matchedModules, 'mapping entry has matchedModules');
  }

  if (untested.length > 0) {
    assert(untested[0].module, 'untested entry has module');
    assert(untested[0].suggestedTestName, 'untested entry has suggestedTestName');
  }

  console.log('Result: ' + pass + ' PASS, ' + fail + ' FAIL');
  process.exit(fail ? 1 : 0);
}
run().catch(e => { console.error('Test error:', e); process.exit(1); });

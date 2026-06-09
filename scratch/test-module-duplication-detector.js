'use strict';

const con = require('../src/consolidation');

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL:', msg); } }

async function run() {
  const svc = {};

  const dupModules = await con.moduleDuplicationDetector.detectDuplicateModules(svc);
  assert(Array.isArray(dupModules), 'detectDuplicateModules returns array');

  const dupFunctions = await con.moduleDuplicationDetector.detectDuplicateFunctionNames(svc);
  assert(Array.isArray(dupFunctions), 'detectDuplicateFunctionNames returns array');

  const overlappingRoutes = await con.moduleDuplicationDetector.detectOverlappingRouteModules(svc);
  assert(Array.isArray(overlappingRoutes), 'detectOverlappingRouteModules returns array');

  const overlappingTabs = await con.moduleDuplicationDetector.detectOverlappingDashboardTabs(svc);
  assert(Array.isArray(overlappingTabs), 'detectOverlappingDashboardTabs returns array');

  const commandConflicts = await con.moduleDuplicationDetector.detectOverlappingTelegramCommands(svc);
  assert(Array.isArray(commandConflicts), 'detectOverlappingTelegramCommands returns array');

  const report = con.moduleDuplicationDetector.buildDuplicationReport({
    duplicateModules: dupModules,
    duplicateFunctions: dupFunctions,
    overlappingRoutes,
    overlappingTabs,
    commandConflicts
  }, svc);

  assert(report && typeof report === 'object', 'buildDuplicationReport returns object');
  assert(typeof report.totalFindings === 'number', 'report has totalFindings');
  assert(Array.isArray(report.findings), 'report has findings array');
  assert(report.summary, 'report has summary');

  console.log('Result: ' + pass + ' PASS, ' + fail + ' FAIL');
  process.exit(fail ? 1 : 0);
}
run().catch(e => { console.error('Test error:', e); process.exit(1); });

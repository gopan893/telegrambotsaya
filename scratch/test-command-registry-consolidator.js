'use strict';

const con = require('../src/consolidation');

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL:', msg); } }

async function run() {
  const svc = {};

  const commands = await con.commandRegistryConsolidator.auditTelegramCommands(svc);
  assert(Array.isArray(commands), 'auditTelegramCommands returns array');
  assert(commands.length > 0, 'found at least 1 command');

  const conflicts = await con.commandRegistryConsolidator.detectCommandConflicts(svc);
  assert(Array.isArray(conflicts), 'detectCommandConflicts returns array');

  const missingDocs = await con.commandRegistryConsolidator.detectMissingCommandDocs(svc);
  assert(Array.isArray(missingDocs), 'detectMissingCommandDocs returns array');

  const unsafe = await con.commandRegistryConsolidator.detectUnsafeCommandRoutes(svc);
  assert(Array.isArray(unsafe), 'detectUnsafeCommandRoutes returns array');

  const report = con.commandRegistryConsolidator.buildCommandRegistryReport(svc);
  assert(report && typeof report === 'object', 'buildCommandRegistryReport returns object');
  assert(report.timestamp, 'report has timestamp');

  if (commands.length > 0) {
    assert(commands[0].name, 'command has name');
    assert(commands[0].riskLevel, 'command has riskLevel');
  }

  console.log('Result: ' + pass + ' PASS, ' + fail + ' FAIL');
  process.exit(fail ? 1 : 0);
}
run().catch(e => { console.error('Test error:', e); process.exit(1); });

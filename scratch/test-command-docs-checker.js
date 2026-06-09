'use strict';

const docsIntel = require('../src/docs-intel');

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) pass++; else { fail++; console.error(`FAIL: ${msg}`); } }

async function run() {
  const svc = { fs: require('fs') };

  const cmds = await docsIntel.commandDocsChecker.checkCommandDocsCoverage(svc);
  assert(cmds.total > 0, 'checkCommandDocsCoverage has total');
  assert(typeof cmds.documented === 'number', 'has documented count');
  assert(typeof cmds.missing === 'number', 'has missing count');
  assert(cmds.results.length === cmds.total, 'results length matches');

  // Check specific commands
  const researchCmd = cmds.results.find(r => r.command === '/research');
  assert(researchCmd, 'has /research in results');

  const modelRouterCmd = cmds.results.find(r => r.command === '/modelrouter');
  assert(modelRouterCmd, 'has /modelrouter in results');

  console.log(`Result: ${pass} PASS, ${fail} FAIL`);
  process.exit(fail ? 1 : 0);
}
run().catch(e => { console.error('Test error:', e); process.exit(1); });

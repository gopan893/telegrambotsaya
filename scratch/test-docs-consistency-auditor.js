'use strict';

const con = require('../src/consolidation');

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL:', msg); } }

async function run() {
  const svc = {};

  const docs = await con.docsConsistencyAuditor.auditDocsConsistency(svc);
  assert(docs && typeof docs === 'object', 'auditDocsConsistency returns object');

  const missing = await con.docsConsistencyAuditor.detectMissingModuleDocs(svc);
  assert(Array.isArray(missing), 'detectMissingModuleDocs returns array');

  const outdatedCmds = await con.docsConsistencyAuditor.detectOutdatedCommandDocs(svc);
  assert(Array.isArray(outdatedCmds), 'detectOutdatedCommandDocs returns array');

  const outdatedEnv = await con.docsConsistencyAuditor.detectOutdatedEnvDocs(svc);
  assert(Array.isArray(outdatedEnv), 'detectOutdatedEnvDocs returns array');

  const outdatedArch = await con.docsConsistencyAuditor.detectOutdatedArchitectureDocs(svc);
  assert(Array.isArray(outdatedArch), 'detectOutdatedArchitectureDocs returns array');

  const report = con.docsConsistencyAuditor.buildDocsConsistencyReport(svc);
  assert(report && typeof report === 'object', 'buildDocsConsistencyReport returns object');
  assert(report.timestamp, 'report has timestamp');
  assert(Array.isArray(report.docsToKeepCurrent), 'report has docsToKeepCurrent');

  const requiredDocs = ['README.md', 'AGENTS.md', 'docs/COMMANDS.md', 'docs/TESTING.md', 'docs/ARCHITECTURE_MAP.md', 'docs/INTEGRATION_CONTRACT.md', 'docs/AGENT_HANDOFF.md'];
  for (const doc of requiredDocs) {
    assert(doc in docs, `docs has ${doc}`);
  }

  console.log('Result: ' + pass + ' PASS, ' + fail + ' FAIL');
  process.exit(fail ? 1 : 0);
}
run().catch(e => { console.error('Test error:', e); process.exit(1); });

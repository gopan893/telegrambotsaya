'use strict';

const docsIntel = require('../src/docs-intel');

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) pass++; else { fail++; console.error(`FAIL: ${msg}`); } }

async function run() {
  const svc = { fs: require('fs') };

  const freshness = await docsIntel.docsFreshnessReviewer.reviewDocsFreshness(svc);
  assert(Array.isArray(freshness), 'reviewDocsFreshness returns array');

  const phase = await docsIntel.docsFreshnessReviewer.detectOutdatedPhaseDocs(svc);
  assert(Array.isArray(phase), 'detectOutdatedPhaseDocs returns array');

  const env = await docsIntel.docsFreshnessReviewer.detectOutdatedEnvDocs(svc);
  assert(Array.isArray(env), 'detectOutdatedEnvDocs returns array');

  const dash = await docsIntel.docsFreshnessReviewer.detectOutdatedDashboardDocs(svc);
  assert(Array.isArray(dash), 'detectOutdatedDashboardDocs returns array');

  const rel = await docsIntel.docsFreshnessReviewer.detectOutdatedReleaseDocs(svc);
  assert(Array.isArray(rel), 'detectOutdatedReleaseDocs returns array');

  console.log(`Result: ${pass} PASS, ${fail} FAIL`);
  process.exit(fail ? 1 : 0);
}
run().catch(e => { console.error('Test error:', e); process.exit(1); });

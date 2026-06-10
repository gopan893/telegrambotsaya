'use strict';
const assert = require('assert');
const path = require('path');
const ROOT = path.join(__dirname, '..');

async function run() {
  let passed = 0;
  let failed = 0;
  const failures = [];

  function check(ok, msg) {
    if (ok) { console.log('PASS: ' + msg); passed++; }
    else { console.log('FAIL: ' + msg); failed++; failures.push(msg); }
  }

  console.log('=== Post-V2 Rollback Advisor ===\n');

  const store = require(path.join(ROOT, 'src/post-v2/post-v2-watch-store'));
  const ra = require(path.join(ROOT, 'src/post-v2/post-v2-rollback-advisor'));

  store.clearAll();
  const watch = store.createPostV2Watch({ version: 'v2.0.1' });

  const evalResult = ra.evaluateRollbackNeedPostV2(watch.id, {});
  check(typeof evalResult.needed === 'boolean', 'evaluateRollbackNeedPostV2 returns needed');
  check(typeof evalResult.severity === 'string', 'evaluateRollbackNeedPostV2 returns severity');
  check(typeof evalResult.reason === 'string', 'evaluateRollbackNeedPostV2 returns reason');

  const recommendation = ra.buildRollbackRecommendation(watch.id, {});
  check(typeof recommendation.needed === 'boolean', 'buildRollbackRecommendation returns needed');
  check(recommendation.proposalOnly === true, 'buildRollbackRecommendation is proposalOnly');

  const incident = { id: 'inc-1', severity: 'critical', detail: 'API regression detected' };
  const proposal = ra.createRollbackProposalFromPostV2Incident(incident, {});
  check(!!proposal, 'createRollbackProposalFromPostV2Incident returns proposal');
  check(proposal.status === 'proposal', 'createRollbackProposalFromPostV2Incident is proposal');
  check(proposal.proposalOnly === true, 'createRollbackProposalFromPostV2Incident is proposalOnly');
  check(proposal.note.includes('PROPOSAL ONLY'), 'createRollbackProposalFromPostV2Incident has PROPOSAL ONLY note');

  const report = ra.buildRollbackAdvisorReport(watch.id, {});
  check(report.proposalOnly === true, 'buildRollbackAdvisorReport is proposalOnly');
  check(report.noAutoRollback === true, 'buildRollbackAdvisorReport has noAutoRollback');

  store.clearAll();

  console.log('\n=== Rollback Advisor: ' + passed + ' passed, ' + failed + ' failed ===');
  if (failures.length > 0) {
    for (const f of failures) { console.error('  FAILED: ' + f); }
  }
  if (failed > 0) process.exit(1);
}

run().catch(err => { console.error('FAIL:', err.message); process.exit(1); });

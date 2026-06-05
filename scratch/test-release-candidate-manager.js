'use strict';

const rcm = require('../src/deploy/release-candidate-manager');

let passed = 0, failed = 0;
function assert(cond, label) {
  if (cond) { passed++; console.log('  ✅ ' + label); }
  else { failed++; console.log('  ❌ ' + label); }
}

console.log('\n--- release-candidate-manager ---');
const created = rcm.createReleaseCandidate({ branch: 'main', commitSha: 'abc123', commitMessage: 'Test release' });
assert(created.ok === true, 'createReleaseCandidate ok');
assert(created.candidate.status === 'draft', 'status is draft');
assert(created.candidate.branch === 'main', 'branch set');
assert(created.candidate.commitSha === 'abc123', 'commitSha set');
assert(created.candidate.id.length > 0, 'id generated');

const found = rcm.getReleaseCandidate(created.candidate.id);
assert(found.ok === true, 'getReleaseCandidate found');
assert(found.candidate.id === created.candidate.id, 'correct id');

const notFound = rcm.getReleaseCandidate('nonexistent');
assert(notFound.ok === false, 'getReleaseCandidate not found');

const list = rcm.listReleaseCandidates();
assert(list.ok === true, 'listReleaseCandidates ok');
assert(list.candidates.length >= 1, 'at least 1 candidate');

const updated = rcm.updateReleaseCandidateStatus(created.candidate.id, 'validated');
assert(updated.ok === true, 'updateReleaseCandidateStatus ok');
assert(updated.candidate.status === 'validated', 'status changed');

const linked = rcm.linkReleaseCandidateToGithubRun(created.candidate.id, 'run-123');
assert(linked.ok === true, 'linkReleaseCandidateToGithubRun ok');
assert(linked.candidate.githubRunId === 'run-123', 'githubRunId set');

const linkedPlan = rcm.linkReleaseCandidateToDeployPlan(created.candidate.id, 'plan-123');
assert(linkedPlan.ok === true, 'linkReleaseCandidateToDeployPlan ok');
assert(linkedPlan.candidate.deployPlanId === 'plan-123', 'deployPlanId set');

const filtered = rcm.listReleaseCandidates({ status: 'validated' });
assert(filtered.candidates.length >= 1, 'filter by status works');

console.log(`\n${'='.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);

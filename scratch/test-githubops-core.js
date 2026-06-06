'use strict';

const utils = require('../src/githubops/githubops-utils');
const store = require('../src/githubops/githubops-store');
const repoState = require('../src/githubops/github-repo-state');
const changeManifest = require('../src/githubops/git-change-manifest');
const secretScan = require('../src/githubops/git-secret-scan');
const commitPlan = require('../src/githubops/git-commit-plan');
const pushPlan = require('../src/githubops/git-push-plan');
const pushProposal = require('../src/githubops/git-push-proposal');
const workflowRunProposal = require('../src/githubops/workflow-run-proposal');
const monitor = require('../src/githubops/github-actions-monitor');
const releaseGate = require('../src/githubops/github-release-gate');
const pipeline = require('../src/githubops/githubops-pipeline');

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) { passed++; console.log('  ✅ ' + label); }
  else { failed++; console.log('  ❌ ' + label); }
}

// --- utils ---
console.log('\n--- githubops-utils ---');
assert(typeof utils.now() === 'string', 'now() returns ISO string');
assert(typeof utils.shortId() === 'string', 'shortId() returns string');
assert(utils.shortId().length > 4, 'shortId() has reasonable length');
assert(utils.maskSecrets('TOKEN=abc123') === 'TOKEN=[REDACTED]', 'maskSecrets redacts TOKEN');
assert(utils.maskSecrets('GITHUB_TOKEN=ghp_abc') === 'GITHUB_TOKEN=[REDACTED]', 'maskSecrets redacts GITHUB_TOKEN');
assert(utils.maskSecrets(null) === '', 'maskSecrets null returns empty');
assert(utils.maskSecrets(undefined) === '', 'maskSecrets undefined returns empty');
assert(utils.truncate('hello world', 5) === 'hello...', 'truncate works');
assert(utils.truncate('hello', 10) === 'hello', 'truncate short string');

// --- store ---
console.log('\n--- githubops-store ---');
store.clear();
assert(store.getRepoState() === null, 'getRepoState returns null after clear');
assert(Array.isArray(store.getCommitPlans()), 'getCommitPlans returns array');
assert(Array.isArray(store.getPushPlans()), 'getPushPlans returns array');
assert(Array.isArray(store.getPushProposals()), 'getPushProposals returns array');
assert(Array.isArray(store.getWorkflowRunPlans()), 'getWorkflowRunPlans returns array');
assert(Array.isArray(store.getWorkflowRunProposals()), 'getWorkflowRunProposals returns array');
assert(Array.isArray(store.getReleaseGates()), 'getReleaseGates returns array');

store.setRepoState({ ok: true, branch: 'test' });
assert(store.getRepoState().branch === 'test', 'setRepoState/getRepoState roundtrip');

store.addCommitPlan({ id: 'c1' });
assert(store.getCommitPlans().length === 1, 'addCommitPlan works');

store.addPushPlan({ id: 'p1' });
assert(store.getPushPlans().length === 1, 'addPushPlan works');

store.addPushProposal({ id: 'pp1' });
assert(store.getPushProposals().length === 1, 'addPushProposal works');

store.addWorkflowRunProposal({ id: 'wr1' });
assert(store.getWorkflowRunProposals().length === 1, 'addWorkflowRunProposal works');

store.addReleaseGate({ id: 'rg1' });
assert(store.getReleaseGates().length === 1, 'addReleaseGate works');

store.clear();
assert(store.getRepoState() === null, 'clear() resets state');

// --- change manifest ---
console.log('\n--- git-change-manifest ---');
const mockState = {
  ok: true,
  changedFiles: ['src/dashboard/test.js', 'src/executor/test.js', '.github/workflows/ci.yml', 'docs/readme.md'],
  branch: 'main',
  isMainOrMaster: true,
  untrackedFiles: [],
  totalChanges: 4,
  summary: '4 files changed'
};
const manifest = changeManifest.buildGitChangeManifest(mockState);
assert(manifest.totalChanged === 4, 'buildGitChangeManifest counts files');
assert(manifest.classified.dashboard.length === 1, 'dashboard file classified');
assert(manifest.classified.executor.length === 1, 'executor file classified');
assert(manifest.classified.cicd.length === 1, 'cicd file classified');
assert(manifest.classified.docs.length === 1, 'docs file classified');
assert(manifest.risks.length > 0, 'risks generated');

// --- secret scan ---
console.log('\n--- git-secret-scan ---');
const findings = secretScan.scanChangedFilesForSecrets([], {});
assert(Array.isArray(findings), 'scanChangedFilesForSecrets returns array');
assert(findings.length === 0, 'empty scan returns no findings');

const diffFindings = secretScan.scanGitDiffForSecrets('GITHUB_TOKEN = abc123');
assert(diffFindings.length > 0, 'scanGitDiffForSecrets finds token in diff');

const report = secretScan.buildSecretScanReport([]);
assert(report.ok === true, 'scan report ok for no findings');
assert(report.totalFindings === 0, 'no findings count');

const blockedReport = secretScan.buildSecretScanReport([{ secretType: 'GITHUB_TOKEN', count: 1 }]);
assert(blockedReport.blocked === true, 'blocked when secrets found');
assert(blockedReport.ok === false, 'not ok when blocked');

// --- commit plan ---
console.log('\n--- git-commit-plan ---');
const emptyResult = commitPlan.createCommitPlan(null);
assert(emptyResult.ok === false, 'null manifest returns not ok');

const commitResult = commitPlan.createCommitPlan(manifest);
assert(commitResult.ok === true, 'valid manifest creates commit plan');
assert(typeof commitResult.plan.id === 'string', 'plan has id');
assert(commitResult.plan.fileCount === 4, 'plan has fileCount');
assert(commitResult.plan.suggestedMessage.length > 0, 'plan has suggested message');

const validation = commitPlan.validateCommitPlan(commitResult.plan);
assert(validation.ok === true, 'valid plan passes validation');

const badValidation = commitPlan.validateCommitPlan(null);
assert(badValidation.ok === false, 'null plan fails validation');

// --- push plan ---
console.log('\n--- git-push-plan ---');
const pushResult = pushPlan.createPushPlan({ ok: false });
assert(pushResult.ok === false, 'rejects invalid commit plan');

const validPushPlan = pushPlan.createPushPlan(commitResult);
assert(validPushPlan.ok === true, 'valid commit plan creates push plan');
assert(typeof validPushPlan.plan.id === 'string', 'push plan has id');
assert(validPushPlan.plan.pushReady === false, 'push not ready initially');
assert(validPushPlan.plan.status === 'draft', 'status is draft');
assert(validPushPlan.plan.secretScanPassed === null, 'secretScan not run yet');

const branchPolicy = pushPlan.validateBranchPolicy(validPushPlan.plan);
assert(typeof branchPolicy.ok === 'boolean', 'branch policy validates');

const readiness = pushPlan.validatePushReadiness(validPushPlan.plan);
assert(readiness.ready === false, 'not ready without checks');
assert(readiness.checks.length > 0, 'has readiness checks');

// --- push proposal ---
console.log('\n--- git-push-proposal ---');
store.clear();
const propResult = pushProposal.createPushProposal({ ok: false });
assert(propResult.ok === false, 'rejects invalid push plan');

const validProp = pushProposal.createPushProposal(validPushPlan);
assert(validProp.ok === true, 'valid push plan creates proposal');
assert(validProp.proposal.type === 'push', 'proposal type is push');
assert(validProp.proposal.status === 'pending_approval', 'proposal pending approval');
assert(validProp.proposal.executorApproval === null, 'no approval yet');

const statusText = pushProposal.statusText(validProp.proposal);
assert(statusText === 'PENDING_APPROVAL', 'statusText for pending');

const approved = pushProposal.approvePushProposal(validProp.proposal.id, 'test-executor');
assert(approved.ok === true, 'approve proposal');
assert(approved.proposal.executorApproval === 'approved', 'status is approved');

const doubleApprove = pushProposal.approvePushProposal(validProp.proposal.id, 'test-executor');
assert(doubleApprove.ok === false, 'double approve rejected');

const notFound = pushProposal.approvePushProposal('nonexistent', 'exec');
assert(notFound.ok === false, 'approve nonexistent rejected');

// create another for reject test
const prop2 = pushProposal.createPushProposal(validPushPlan);
const rejected = pushProposal.rejectPushProposal(prop2.proposal.id, 'test reason', 'executor');
assert(rejected.ok === true, 'reject proposal');
assert(rejected.proposal.status === 'rejected', 'status rejected');

const proposals = pushProposal.listPushProposals();
assert(proposals.length === 2, 'listPushProposals returns 2');

const pending = pushProposal.listPushProposals({ status: 'pending_approval' });
assert(pending.length === 0, 'no pending after approve/reject');

// --- workflow run proposal ---
console.log('\n--- workflow-run-proposal ---');
const wfList = workflowRunProposal.listAvailableWorkflows();
assert(wfList.length > 0, 'listAvailableWorkflows returns workflows');

const wfResult = workflowRunProposal.createWorkflowRunProposal('nonexistent.yml', 'main');
assert(wfResult.ok === false, 'nonexistent workflow rejected');

const wfValid = workflowRunProposal.createWorkflowRunProposal('ci.yml', 'main');
assert(wfValid.ok === true, 'create workflow run proposal');
assert(wfValid.proposal.type === 'workflow_run', 'type is workflow_run');
assert(wfValid.proposal.warnings.length > 0, 'has warnings');

const wfApproved = workflowRunProposal.approveWorkflowRunProposal(wfValid.proposal.id, 'exec');
assert(wfApproved.ok === true, 'approve workflow proposal');

const wfDouble = workflowRunProposal.approveWorkflowRunProposal(wfValid.proposal.id, 'exec');
assert(wfDouble.ok === false, 'double approve workflow rejected');

const wfNotFound = workflowRunProposal.approveWorkflowRunProposal('nope', 'exec');
assert(wfNotFound.ok === false, 'approve nonexistent workflow rejected');

// --- monitor ---
console.log('\n--- github-actions-monitor ---');
const simRun = monitor.simulateWorkflowDispatch('ci.yml', 'main');
assert(simRun.status === 'queued', 'simulated run starts queued');

const progressed = monitor.simulateRunProgress(simRun.id);
assert(progressed.status === 'in_progress', 'progress changes to in_progress');

const completed = monitor.simulateRunCompletion(simRun.id, 'success');
assert(completed.status === 'completed', 'completion status');
assert(completed.conclusion === 'success', 'conclusion is success');

const status = monitor.getSimulationStatus(simRun.id);
assert(status !== null, 'getSimulationStatus returns run');

const all = monitor.listSimulations();
assert(all.length > 0, 'listSimulations returns runs');

const simNotFound = monitor.getSimulationStatus('nope');
assert(simNotFound === null, 'nonexistent run returns null');

// --- release gate ---
console.log('\n--- github-release-gate ---');
const gate = releaseGate.evaluateReleaseReadiness({ pushProposals: [], workflowProposals: [] }, 'unknown');
assert(!gate.allPassed, 'release gate blocked without approvals');

const gate2 = releaseGate.evaluateReleaseReadiness(
  { pushProposals: [{ executorApproval: 'approved' }], workflowProposals: [{ executorApproval: 'approved' }] },
  'success'
);
assert(gate2.allPassed, 'release gate passes with approvals and CI success');

const summary = releaseGate.buildReleaseSummary(gate2);
assert(summary.includes('READY FOR RELEASE'), 'summary says ready');

const emptySummary = releaseGate.buildReleaseSummary(null);
assert(typeof emptySummary === 'string', 'empty summary returns string');

// --- pipeline integration ---
console.log('\n--- githubops-pipeline ---');
const pipelineResult = pipeline.runFullPipeline({});
assert(pipelineResult.ok === true || pipelineResult.step === 'repoState', 'pipeline runs (may fail if no git repo)');

const pipelineSummary = pipeline.getPipelineSummary(pipelineResult.ok ? pipelineResult : null);
assert(typeof pipelineSummary.ok === 'boolean', 'pipeline summary returns ok');

// --- summary ---
console.log(`\n${'='.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`${'='.repeat(40)}`);
process.exit(failed > 0 ? 1 : 0);

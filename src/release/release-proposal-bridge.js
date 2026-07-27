'use strict';

const utils = require('./release-utils');

async function createReleaseActionPlan(releaseCandidateId, services = {}) {
  const releaseStore = require('./release-candidate-store');
  const candidate = releaseStore.getReleaseCandidate(releaseCandidateId);
  if (!candidate) return { ok: false, error: 'Release candidate not found' };

  const plan = {
    type: 'release_action_plan',
    releaseCandidateId,
    version: candidate.version,
    title: 'Release Action Plan for ' + candidate.version,
    actions: [
      { step: 1, action: 'Verify all env vars are configured', status: 'pending', assignee: 'admin' },
      { step: 2, action: 'Run module readiness check', status: 'pending', assignee: 'system' },
      { step: 3, action: 'Run production readiness gate', status: 'pending', assignee: 'system' },
      { step: 4, action: 'Run compatibility verification', status: 'pending', assignee: 'system' },
      { step: 5, action: 'Review release risks', status: 'pending', assignee: 'admin' },
      { step: 6, action: 'Generate release notes', status: 'pending', assignee: 'system' },
      { step: 7, action: 'Generate changelog', status: 'pending', assignee: 'system' },
      { step: 8, action: 'Generate env checklist', status: 'pending', assignee: 'system' },
      { step: 9, action: 'Generate operator guide', status: 'pending', assignee: 'system' },
      { step: 10, action: 'Create GitHub tag/release proposal (external write)', status: 'pending', assignee: 'proposal_only' },
      { step: 11, action: 'Create deploy proposal (external write)', status: 'pending', assignee: 'proposal_only' }
    ],
    proposalOnly: true,
    requiresApproval: true,
    timestamp: utils.formatTimestamp()
  };

  return { ok: true, plan };
}

async function createGitHubTagProposal(releaseCandidateId, services = {}) {
  const releaseStore = require('./release-candidate-store');
  const candidate = releaseStore.getReleaseCandidate(releaseCandidateId);
  if (!candidate) return { ok: false, error: 'Release candidate not found' };

  const env = services.env || process.env || {};
  const hasGitHubCredentials = Boolean(env.GITHUB_TOKEN && env.GITHUB_REPO && env.GITHUB_OWNER);

  const proposal = {
    type: 'github_tag_proposal',
    releaseCandidateId,
    version: candidate.version,
    title: 'GitHub Tag Proposal: ' + candidate.version,
    tagName: candidate.version,
    targetBranch: candidate.branch || 'main',
    commitSha: candidate.commitSha || '',
    action: 'create_git_tag',
    status: 'proposal_only',
    requiresEvalV2: true,
    requiresExecutorApproval: true,
    note: hasGitHubCredentials
      ? 'GitHub credentials configured. This proposal can proceed through Evaluation v2 -> executor approval -> run.'
      : 'GitHub credentials not configured. Manual steps required: git tag ' + candidate.version + ' && git push origin ' + candidate.version,
    manualInstructions: hasGitHubCredentials ? null : 'Run: git tag ' + candidate.version + ' && git push origin ' + candidate.version,
    timestamp: utils.formatTimestamp()
  };

  return { ok: true, proposal };
}

async function createGitHubReleaseProposal(releaseCandidateId, services = {}) {
  const releaseStore = require('./release-candidate-store');
  const candidate = releaseStore.getReleaseCandidate(releaseCandidateId);
  if (!candidate) return { ok: false, error: 'Release candidate not found' };

  const env = services.env || process.env || {};
  const hasGitHubCredentials = Boolean(env.GITHUB_TOKEN && env.GITHUB_REPO && env.GITHUB_OWNER);

  const proposal = {
    type: 'github_release_proposal',
    releaseCandidateId,
    version: candidate.version,
    title: 'GitHub Release Proposal: ' + candidate.version,
    tagName: candidate.version,
    releaseName: 'Stable AI OS ' + candidate.version,
    body: 'Release Candidate for Stable AI OS v1. See docs/AI_OS_V1_CHANGELOG.md for details.',
    action: 'create_github_release',
    status: 'proposal_only',
    requiresEvalV2: true,
    requiresExecutorApproval: true,
    note: hasGitHubCredentials
      ? 'GitHub credentials configured. Use gh release create command via executor proposal.'
      : 'GitHub credentials not configured. Manual instructions provided.',
    manualInstructions: hasGitHubCredentials
      ? null
      : 'Run: gh release create ' + candidate.version + ' --title "Stable AI OS ' + candidate.version + '" --notes "See changelog in docs/AI_OS_V1_CHANGELOG.md"',
    timestamp: utils.formatTimestamp()
  };

  return { ok: true, proposal };
}

async function createDeployReleaseProposal(releaseCandidateId, services = {}) {
  const releaseStore = require('./release-candidate-store');
  const candidate = releaseStore.getReleaseCandidate(releaseCandidateId);
  if (!candidate) return { ok: false, error: 'Release candidate not found' };

  const env = services.env || process.env || {};
  const hasRenderCredentials = Boolean(env.RENDER_API_KEY && env.RENDER_SERVICE_ID);

  const proposal = {
    type: 'deploy_release_proposal',
    releaseCandidateId,
    version: candidate.version,
    title: 'Deploy Release Proposal: ' + candidate.version,
    target: 'render',
    action: 'deploy',
    status: 'proposal_only',
    requiresEvalV2: true,
    requiresExecutorApproval: true,
    note: hasRenderCredentials
      ? 'Render credentials configured. Deploy proposal can proceed through Evaluation v2 -> executor approval -> run.'
      : 'Render credentials not configured. Manual deploy via Render dashboard or git push.',
    manualInstructions: hasRenderCredentials
      ? null
      : 'Deploy manually: push to GitHub main branch (Render auto-deploys) or trigger deploy via Render dashboard.',
    timestamp: utils.formatTimestamp()
  };

  return { ok: true, proposal };
}

async function linkReleaseProposal(releaseCandidateId, proposalId, services = {}) {
  const releaseStore = require('./release-candidate-store');
  const candidate = releaseStore.getReleaseCandidate(releaseCandidateId);
  if (!candidate) return { ok: false, error: 'Release candidate not found' };

  releaseStore.updateReleaseCandidate(releaseCandidateId, {
    reportId: proposalId
  });

  return { ok: true, linked: true, releaseCandidateId, proposalId };
}

module.exports = {
  createReleaseActionPlan,
  createGitHubTagProposal,
  createGitHubReleaseProposal,
  createDeployReleaseProposal,
  linkReleaseProposal
};

'use strict';

const { getReleaseCandidate, updateReleaseCandidate } = require('./v2-release-store');

function createV2ReleaseActionPlan(candidateId, services) {
  const candidate = getReleaseCandidate(candidateId);
  if (!candidate) return null;

  return {
    candidateId,
    version: candidate.version,
    proposals: [
      { type: 'github-tag', status: 'pending', requiresApproval: true },
      { type: 'github-release', status: 'pending', requiresApproval: true },
      { type: 'deploy', status: 'pending', requiresApproval: true },
    ],
    note: 'Action plan created. Each proposal requires separate approval before execution.',
    timestamp: new Date().toISOString(),
  };
}

function createV2GitHubTagProposal(candidateId, services) {
  const candidate = getReleaseCandidate(candidateId);
  if (!candidate) return null;

  const hasCredentials = services && services.gitHubToken;

  if (!hasCredentials) {
    return {
      candidateId,
      version: candidate.version,
      type: 'github-tag',
      status: 'manual',
      requiresApproval: true,
      manualInstructions: [
        `git tag -a ${candidate.version} -m "Release ${candidate.version}"`,
        `git push origin ${candidate.version}`,
      ],
      note: 'GitHub credentials not available. Follow manual instructions above.',
    };
  }

  return {
    candidateId,
    version: candidate.version,
    type: 'github-tag',
    status: 'proposed',
    requiresApproval: true,
    note: 'Tag proposal created. Awaiting approval before execution.',
  };
}

function createV2GitHubReleaseProposal(candidateId, services) {
  const candidate = getReleaseCandidate(candidateId);
  if (!candidate) return null;

  const hasCredentials = services && services.gitHubToken;

  if (!hasCredentials) {
    return {
      candidateId,
      version: candidate.version,
      type: 'github-release',
      status: 'manual',
      requiresApproval: true,
      manualInstructions: [
        `gh release create ${candidate.version} --title "Release ${candidate.version}" --notes "See changelog for details"`,
      ],
      note: 'GitHub credentials not available. Follow manual instructions above.',
    };
  }

  return {
    candidateId,
    version: candidate.version,
    type: 'github-release',
    status: 'proposed',
    requiresApproval: true,
    note: 'Release proposal created. Awaiting approval before execution.',
  };
}

function createV2DeployProposal(candidateId, services) {
  const candidate = getReleaseCandidate(candidateId);
  if (!candidate) return null;

  const hasDeployCreds = services && services.deployCredentials;

  if (!hasDeployCreds) {
    return {
      candidateId,
      version: candidate.version,
      type: 'deploy',
      status: 'manual',
      requiresApproval: true,
      manualInstructions: [
        `Deploy ${candidate.version} to staging environment`,
        'Run smoke tests against staging',
        'Promote to production after smoke test pass',
      ],
      note: 'Deploy credentials not available. Follow manual instructions above.',
    };
  }

  return {
    candidateId,
    version: candidate.version,
    type: 'deploy',
    status: 'proposed',
    requiresApproval: true,
    note: 'Deploy proposal created. Awaiting approval before execution.',
  };
}

function linkV2ReleaseProposal(candidateId, proposalId, services) {
  const candidate = getReleaseCandidate(candidateId);
  if (!candidate) return null;

  const proposalIds = candidate.proposalIds || [];
  if (!proposalIds.includes(proposalId)) {
    proposalIds.push(proposalId);
  }

  updateReleaseCandidate(candidateId, { proposalIds });

  return {
    candidateId,
    proposalId,
    allProposalIds: proposalIds,
    timestamp: new Date().toISOString(),
  };
}

module.exports = {
  createV2ReleaseActionPlan,
  createV2GitHubTagProposal,
  createV2GitHubReleaseProposal,
  createV2DeployProposal,
  linkV2ReleaseProposal,
};

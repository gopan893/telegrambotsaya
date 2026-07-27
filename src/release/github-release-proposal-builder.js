'use strict';

const utils = require('./release-utils');

const GitHubReleaseProposalBuilder = {
  buildGitHubTagProposal(releaseId, services = {}) {
    const env = services.env || process.env;
    const hasCredentials = !!(env.GITHUB_TOKEN && env.GITHUB_REPO && env.GITHUB_OWNER);
    return {
      proposalType: 'github_tag',
      releaseId,
      version: 'v1.0.0',
      action: 'Create GitHub tag v1.0.0 on main branch',
      directAction: false,
      requiresEvaluation: true,
      requiresApproval: true,
      requiresCredentials: hasCredentials,
      credentialsConfigured: hasCredentials,
      manualInstructions: hasCredentials ? null : 'Set GITHUB_TOKEN, GITHUB_REPO, and GITHUB_OWNER env vars, then run: git tag v1.0.0 && git push origin v1.0.0',
      details: {
        tag: 'v1.0.0',
        branch: 'main',
        message: 'Stable AI OS v1.0.0 Production Release'
      },
      createdAt: utils.formatTimestamp()
    };
  },

  buildGitHubReleaseProposal(releaseId, services = {}) {
    const env = services.env || process.env;
    const hasCredentials = !!(env.GITHUB_TOKEN && env.GITHUB_REPO && env.GITHUB_OWNER);
    return {
      proposalType: 'github_release',
      releaseId,
      version: 'v1.0.0',
      action: 'Create GitHub Release v1.0.0 from tag',
      directAction: false,
      requiresEvaluation: true,
      requiresApproval: true,
      requiresCredentials: hasCredentials,
      credentialsConfigured: hasCredentials,
      manualInstructions: hasCredentials ? null : 'Create release manually at https://github.com/OWNER/REPO/releases with tag v1.0.0',
      details: {
        tag: 'v1.0.0',
        name: 'Stable AI OS v1.0.0',
        body: 'See docs/AI_OS_V1_CHANGELOG.md for full changelog.'
      },
      createdAt: utils.formatTimestamp()
    };
  },

  buildReleaseNotesForGitHub(releaseId, services = {}) {
    return {
      releaseId,
      version: 'v1.0.0',
      title: 'Stable AI OS v1.0.0 Production Release',
      highlights: [
        'Production-ready release candidate pipeline',
        'Telegram Control Layer with natural language routing',
        'Governance Policy Engine with capability control',
        'Security Hardening Center with red-team audit',
        'Privacy Data Retention & Export Control',
        'Continuous Improvement & Learning Engine',
        'Life OS personal productivity system',
        'Release Candidate stabilization audit (Phase 50.5)',
        'Dashboard with 40+ tabs, PWA, mobile support',
        'Executor approval boundary with Evaluation v2'
      ],
      notes: 'See docs/AI_OS_V1_CHANGELOG.md for detailed changelog. See docs/AI_OS_V1_KNOWN_LIMITATIONS.md for known limitations.',
      createdAt: utils.formatTimestamp()
    };
  }
};

module.exports = GitHubReleaseProposalBuilder;

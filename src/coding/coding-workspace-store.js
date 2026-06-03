'use strict';

const { createCodingId, DEFAULT_CONSTRAINTS } = require('./coding-utils');

const STORAGE_KEYS = {
  codingWorkspaces: 'coding_workspaces',
  codingRequests: 'coding_requests',
  codingChangePlans: 'coding_change_plans',
  codingTestPlans: 'coding_test_plans',
  codingCodexPrompts: 'coding_codex_prompts',
  codingGithubProposals: 'coding_github_proposals',
  codingTasks: 'coding_tasks',
  codingRiskReviews: 'coding_risk_reviews'
};

function createWorkspaceModel(overrides = {}) {
  const now = new Date().toISOString();
  return {
    id: overrides.id || createCodingId('ws'),
    workspaceId: overrides.workspaceId || overrides.id || createCodingId('ws'),
    userId: String(overrides.userId || ''),
    projectName: overrides.projectName || 'telegram-ai-level-tertinggi',
    repoProvider: overrides.repoProvider || 'github',
    repoOwner: overrides.repoOwner || '',
    repoName: overrides.repoName || '',
    defaultBranch: overrides.defaultBranch || 'main',
    techStack: overrides.techStack || 'Node.js 20 CommonJS Express',
    constraints: { ...DEFAULT_CONSTRAINTS, ...(overrides.constraints || {}) },
    status: overrides.status || 'active',
    createdAt: overrides.createdAt || now,
    updatedAt: overrides.updatedAt || now
  };
}

module.exports = {
  STORAGE_KEYS,
  createWorkspaceModel
};

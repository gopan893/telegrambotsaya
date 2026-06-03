'use strict';

const { redactSecrets, DEFAULT_CONSTRAINTS } = require('./coding-utils');
const { STORAGE_KEYS } = require('./coding-workspace-store');

async function getRepoContext(workspaceId, services) {
  const { storageManager } = services;
  if (!storageManager) return null;

  try {
    const workspaces = await storageManager.loadData(
      STORAGE_KEYS.codingWorkspaces, []
    );
    const ws = Array.isArray(workspaces)
      ? workspaces.find(w => w.id === workspaceId || w.workspaceId === workspaceId)
      : null;
    return ws || null;
  } catch (_) {
    return null;
  }
}

async function updateRepoContext(input = {}, services) {
  const { storageManager } = services;
  if (!storageManager) return null;

  const { createWorkspaceModel } = require('./coding-workspace-store');
  const now = new Date().toISOString();

  try {
    const workspaces = await storageManager.loadData(
      STORAGE_KEYS.codingWorkspaces, []
    );
    const list = Array.isArray(workspaces) ? workspaces : [];
    const id = input.id || `ws_${Date.now()}`;
    const idx = list.findIndex(w => w.id === id);

    const updated = createWorkspaceModel({
      ...input,
      id,
      updatedAt: now
    });

    if (idx >= 0) {
      list[idx] = { ...list[idx], ...updated };
    } else {
      list.push(updated);
    }

    await storageManager.saveData(STORAGE_KEYS.codingWorkspaces, list.slice(-50));
    return updated;
  } catch (_) {
    return createWorkspaceModel(input);
  }
}

function getProjectConstraints(workspaceId, services) {
  const ctx = services?.codingWorkspace?.defaultContext;
  if (ctx?.constraints) return ctx.constraints;
  return { ...DEFAULT_CONSTRAINTS };
}

function buildRepoSafeSummary(context) {
  if (!context) return 'No repo context available.';

  const safe = {
    projectName: context.projectName || 'Unknown',
    repoProvider: context.repoProvider || 'github',
    repoOwner: context.repoOwner || '',
    repoName: context.repoName || '',
    defaultBranch: context.defaultBranch || 'main',
    techStack: context.techStack || 'Node.js 20 CommonJS Express',
    status: context.status || 'active'
  };

  return redactSecrets(JSON.stringify(safe, null, 2));
}

function detectMissingRepoConfig(context) {
  const missing = [];
  if (!context) {
    return ['workspace', 'projectName', 'repoProvider', 'repoOwner', 'repoName'];
  }
  if (!context.repoOwner) missing.push('repoOwner');
  if (!context.repoName) missing.push('repoName');
  if (!context.defaultBranch) missing.push('defaultBranch');
  if (!context.techStack) missing.push('techStack');
  return missing;
}

module.exports = {
  getRepoContext,
  updateRepoContext,
  getProjectConstraints,
  buildRepoSafeSummary,
  detectMissingRepoConfig
};

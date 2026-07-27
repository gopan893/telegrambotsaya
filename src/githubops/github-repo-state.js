'use strict';

const fs = require('fs');
const path = require('path');
const utils = require('./githubops-utils');
const store = require('./githubops-store');

function _exec(cmd, cwd) {
  try {
    const { execSync } = require('child_process');
    return execSync(cmd, { cwd, encoding: 'utf8', maxBuffer: 16384, timeout: 15000 }).toString().trim();
  } catch (_) { return null; }
}

function getGitRepoState(services) {
  const repoRoot = services?.repoRoot || process.cwd();

  if (!fs.existsSync(path.join(repoRoot, '.git'))) {
    const s = { ok: false, error: 'NOT_A_GIT_REPO', manualRequired: true };
    store.setRepoState(s);
    return s;
  }

  const originUrl = _exec('git remote get-url origin', repoRoot);
  const branch = getCurrentBranch(services);
  const changed = getChangedFiles(services);
  const untracked = detectUntrackedFiles(services);
  const summary = getUncommittedChangeSummary(services);
  const large = detectLargeDiffRisk(services);

  const state = {
    ok: true,
    isGitRepo: true,
    originUrl: originUrl && !originUrl.includes('token') && !originUrl.includes('ghp_') ? originUrl : '[remote configured]',
    branch,
    isMainOrMaster: branch === 'main' || branch === 'master',
    changedFiles: changed,
    untrackedFiles: untracked,
    totalChanges: changed.length + untracked.length,
    summary,
    largeDiff: large,
    largeDiffWarning: large ? 'Large diff detected — prefer smaller commits' : null,
    timestamp: utils.now()
  };

  store.setRepoState(state);
  return state;
}

function getCurrentBranch(services) {
  const repoRoot = services?.repoRoot || process.cwd();
  const branch = _exec('git rev-parse --abbrev-ref HEAD', repoRoot);
  return branch || 'unknown';
}

function getChangedFiles(services) {
  const repoRoot = services?.repoRoot || process.cwd();
  const diff = _exec('git diff --name-only', repoRoot);
  const staged = _exec('git diff --cached --name-only', repoRoot);
  const files = [];
  if (diff) files.push(...diff.split('\n').filter(Boolean));
  if (staged) files.push(...staged.split('\n').filter(Boolean));
  return [...new Set(files)];
}

function getUncommittedChangeSummary(services) {
  const repoRoot = services?.repoRoot || process.cwd();
  const stat = _exec('git diff --stat', repoRoot);
  if (!stat) return 'No uncommitted changes';
  return utils.truncate(utils.maskSecrets(stat), 500);
}

function detectUntrackedFiles(services) {
  const repoRoot = services?.repoRoot || process.cwd();
  const raw = _exec('git ls-files --others --exclude-standard', repoRoot);
  return raw ? raw.split('\n').filter(Boolean) : [];
}

function detectLargeDiffRisk(services) {
  const repoRoot = services?.repoRoot || process.cwd();
  const lines = _exec('git diff --shortstat', repoRoot);
  if (!lines) return false;
  const match = lines.match(/(\d+) insertions?/);
  const insertions = match ? parseInt(match[1], 10) : 0;
  return insertions > 200;
}

function buildRepoStateSummary(services) {
  const state = getGitRepoState(services);
  if (!state.ok) return state;
  return {
    ok: true,
    branch: state.branch,
    isMainOrMaster: state.isMainOrMaster,
    changedFiles: state.changedFiles.length,
    untrackedFiles: state.untrackedFiles.length,
    totalChanges: state.totalChanges,
    largeDiff: state.largeDiff,
    summary: state.summary
  };
}

module.exports = {
  getGitRepoState,
  getCurrentBranch,
  getChangedFiles,
  getUncommittedChangeSummary,
  detectUntrackedFiles,
  detectLargeDiffRisk,
  buildRepoStateSummary
};

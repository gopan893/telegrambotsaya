'use strict';

/**
 * Git Commit — auto stage, commit, push
 */

const { execSync } = require('child_process');

/**
 * Stage semua perubahan
 */
function stageAll(repoPath) {
  try {
    execSync('git add -A', { cwd: repoPath, stdio: 'pipe', timeout: 15000 });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.stderr?.toString() || e.message };
  }
}

/**
 * Cek apakah ada perubahan
 */
function hasChanges(repoPath) {
  try {
    const out = execSync('git diff --cached --stat', { cwd: repoPath, stdio: 'pipe', timeout: 10000 });
    return out.toString().trim().length > 0;
  } catch (_) {
    return false;
  }
}

/**
 * Commit dan push
 */
function commitAndPush(repoPath, message) {
  const prefix = '[self-dev]';
  const fullMsg = `${prefix} ${message}`;

  try {
    execSync(`git commit -m "${fullMsg.replace(/"/g, '\\"')}"`, { cwd: repoPath, stdio: 'pipe', timeout: 15000 });
  } catch (e) {
    const err = e.stderr?.toString() || e.message;
    if (err.includes('nothing to commit')) return { ok: true, skipped: true, reason: 'nothing_to_commit' };
    return { ok: false, error: err };
  }

  try {
    execSync('git push origin main 2>&1', { cwd: repoPath, stdio: 'pipe', timeout: 30000 });
  } catch (e) {
    const err = e.stderr?.toString() || e.message;
    return { ok: true, pushed: false, error: err };
  }

  return { ok: true, pushed: true };
}

/**
 * Pull rebase sebelum push
 */
function pullRebase(repoPath) {
  try {
    execSync('git pull --rebase origin main 2>&1', { cwd: repoPath, stdio: 'pipe', timeout: 30000 });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.stderr?.toString() || e.message };
  }
}

module.exports = {
  stageAll,
  hasChanges,
  commitAndPush,
  pullRebase
};

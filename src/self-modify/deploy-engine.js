'use strict';

/**
 * Autonomous Deploy — deploy ke Render, pantau hasil
 */

const { execSync } = require('child_process');
const { join } = require('path');
const { ROOT } = require('./source-explorer');

/**
 * Trigger deploy via Git push (sudah auto-di Render)
 * Fungsi ini verifikasi status deploy
 */
function verifyDeploy() {
  try {
    // Cek status git
    const lastCommit = execSync('git log -1 --format="%h %s"', { cwd: ROOT, encoding: 'utf8' }).trim();
    const remoteStatus = execSync('git status -sb', { cwd: ROOT, encoding: 'utf8' }).trim();

    const behind = remoteStatus.includes('behind');
    return {
      ok: !behind,
      lastCommit,
      clean: !remoteStatus.includes('ahead'),
      needsPush: remoteStatus.includes('ahead'),
      behind
    };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/**
 * Build check — cek syntax semua file
 */
function buildCheck() {
  const files = [];
  const glob = require('path').join(ROOT, 'src', '**', '*.js');
  try {
    const found = execSync(`find src -name "*.js" -not -path "*/node_modules/*"`, { cwd: ROOT, encoding: 'utf8' })
      .trim().split('\n').filter(Boolean);

    for (const f of found.slice(0, 50)) {
      try {
        execSync(`node --check "${f}"`, { cwd: ROOT, stdio: 'pipe', encoding: 'utf8' });
        files.push({ file: f, ok: true });
      } catch (e) {
        files.push({ file: f, ok: false, error: e.stderr?.toString().slice(0, 200) || 'syntax error' });
      }
    }

    const failed = files.filter(f => !f.ok);
    return { ok: failed.length === 0, total: files.length, passed: files.length - failed.length, failed, files };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/**
 * Release note generator
 */
function generateReleaseNotes() {
  try {
    const log = execSync('git log --oneline -20', { cwd: ROOT, encoding: 'utf8' }).trim();
    const tags = execSync('git tag --sort=-creatordate', { cwd: ROOT, encoding: 'utf8' }).trim().split('\n').filter(Boolean);

    return {
      ok: true,
      recentCommits: log.split('\n').map(l => ({ hash: l.split(' ')[0], msg: l.slice(l.indexOf(' ') + 1) })),
      tags: tags.slice(0, 5)
    };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

module.exports = { verifyDeploy, buildCheck, generateReleaseNotes };

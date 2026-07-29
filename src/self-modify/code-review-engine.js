'use strict';

/**
 * Code Review Engine — bot review PR/code perubahan sendiri
 * Deteksi security issue, bug pattern, best practice violation
 */

const { readFileSync } = require('fs');
const { join } = require('path');
const { execSync } = require('child_process');
const sourceExplorer = require('./source-explorer');
const refactorEngine = require('./refactor-engine');
const { ROOT } = require('./source-explorer');

/**
 * Review diff git terakhir
 */
function reviewLastDiff() {
  try {
    const diff = execSync('git diff HEAD~1 -- .', { cwd: ROOT, stdio: 'pipe', encoding: 'utf8', maxBuffer: 1024 * 1024 });
    return reviewDiff(diff);
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/**
 * Review diff text
 */
function reviewDiff(diffText) {
  const issues = [];
  const added = [];
  const removed = [];

  // Parse diff
  const lines = diffText.split('\n');
  let currentFile = '';

  for (const line of lines) {
    if (line.startsWith('diff --git a/')) {
      currentFile = line.replace('diff --git a/', '').replace(/ b\/.+$/, '');
    }
    if (line.startsWith('+') && !line.startsWith('+++')) {
      added.push({ file: currentFile, code: line.slice(1) });
    }
    if (line.startsWith('-') && !line.startsWith('---')) {
      removed.push({ file: currentFile, code: line.slice(1) });
    }
  }

  //── Security checks ──
  const securityPattens = [
    { pattern: /eval\s*\(/, severity: 'critical', msg: 'eval() — RCE risk. Jangan pernah eval input user.' },
    { pattern: /process\.env\b/, severity: 'info', msg: 'Mengakses env. Pastikan tidak leak via error message.' },
    { pattern: /exec\(|execSync\(/, severity: 'high', msg: 'exec() — command injection risk. Validasi input.' },
    { pattern: /innerHTML/, severity: 'high', msg: 'innerHTML — XSS risk. Gunakan textContent.' },
    { pattern: /\.env\b.*token|\.env\b.*key|\.env\b.*secret/, severity: 'critical', msg: 'Jangan pernah log env keys!' },
    { pattern: /req\.body|req\.query/, severity: 'medium', msg: 'Input user. Pastikan validated & sanitized.' },
    { pattern: /apiKey|api_key|apikey/, severity: 'info', msg: 'API key terdeteksi. Pastikan dari env, bukan hardcode.' },
  ];

  for (const a of added) {
    for (const sp of securityPattens) {
      if (sp.pattern.test(a.code) && !a.code.trim().startsWith('//') && !a.code.trim().startsWith('*')) {
        issues.push({
          file: a.file,
          line: '-',
          severity: sp.severity,
          type: 'security',
          message: sp.msg,
          code: a.code.trim().slice(0, 100)
        });
      }
    }
  }

  //── Code smells ──
  const smellPatterns = [
    { pattern: /console\.log/, severity: 'low', msg: 'console.log left in code. Hapus atau pake logger.' },
    { pattern: /TODO|FIXME|HACK/, severity: 'low', msg: 'Leftover TODO/FIXME. Selesaikan atau buat issue.' },
    { pattern: /function\s*\(.*\)\s*\{/, severity: 'medium', msg: 'Callback style — refactor ke arrow function / async.' },
    { pattern: /catch\s*\(\s*\)\s*\{/, severity: 'medium', msg: 'Empty catch — jangan swallow error.' },
    { pattern: /var\s+/, severity: 'medium', msg: 'Gunakan const/let, bukan var.' },
    { pattern: /\$\(\s*['"]/, severity: 'low', msg: 'jQuery-like selectors. Ganti querySelector kalo bisa.' },
    { pattern: /\.length\s*>\s*0/, severity: 'info', msg: 'Ganti .length > 0 dengan .some() atau .filter().length > 0' },
  ];

  for (const a of added) {
    for (const sp of smellPatterns) {
      if (sp.pattern.test(a.code) && !a.code.trim().startsWith('//') && !a.code.trim().startsWith('*')) {
        issues.push({
          file: a.file,
          line: '-',
          severity: sp.severity,
          type: 'code-smell',
          message: sp.msg,
          code: a.code.trim().slice(0, 100)
        });
      }
    }
  }

  return {
    ok: true,
    filesChanged: [...new Set([...added.map(a => a.file), ...removed.map(r => r.file)])],
    addedLines: added.length,
    removedLines: removed.length,
    issues
  };
}

/**
 * Git hook — review sebelum commit
 */
function preCommitReview() {
  try {
    const staged = execSync('git diff --cached', { cwd: ROOT, stdio: 'pipe', encoding: 'utf8', maxBuffer: 1024 * 1024 });
    if (!staged.trim()) {
      return { ok: true, issues: [], msg: 'No staged changes' };
    }
    return reviewDiff(staged);
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

module.exports = { reviewLastDiff, reviewDiff, preCommitReview };

'use strict';

/**
 * Autonomous Evolution Engine — siklus periodic self-improvement
 * Level 6: jalan otomatis tiap N pesan / periodic, tanpa diminta user
 */

const autoDetect = require('./auto-detect');
const refactorEngine = require('./refactor-engine');
const gitCommit = require('./git-commit');
const sourceExplorer = require('./source-explorer');
const { ROOT } = require('./source-explorer');

const LOG = [];

function log(level, msg) {
  const entry = { t: Date.now(), level, msg };
  LOG.push(entry);
  if (LOG.length > 500) LOG.shift();
  return entry;
}

/**
 * Satu siklus evolution — scan → prioritaskan → execute → commit
 */
async function runEvolutionCycle(services) {
  const report = { phases: [], fixes: [], errors: [], changed: false };

  report.phases.push('🔍 Scan & detect');
  const scan = await autoDetect.detectImprovements(services);
  const suggestions = scan.suggestions || [];

  log('info', `Scan selesai: ${suggestions.length} saran`);

  if (suggestions.length === 0) {
    report.phases.push('✅ Tidak ada improvement');
    return report;
  }

  //── Prioritaskan ──
  const high = suggestions.filter(s => s.priority === 'high');
  const med = suggestions.filter(s => s.priority === 'medium');
  const autoFixable = [...high, ...med];

  if (autoFixable.length === 0) {
    report.phases.push('ℹ️ Semua saran prioritas rendah');
    return report;
  }

  report.phases.push(`🔨 Eksekusi ${autoFixable.length} improvement`);

  for (const s of autoFixable.slice(0, 5)) {
    try {
      if (s.action === 'refactor') {
        const allIssues = refactorEngine.analyzeAll();
        const targetIssues = allIssues.filter(i => i.file && (i.severity === 'high' || i.severity === 'medium'));
        const fileMap = {};
        for (const iss of targetIssues) {
          if (!fileMap[iss.file]) fileMap[iss.file] = [];
          fileMap[iss.file].push(iss);
        }
        for (const [file, issues] of Object.entries(fileMap).slice(0, 3)) {
          const res = await refactorEngine.refactorPipeline(file, services);
          if (res.ok) {
            report.fixes.push({ file, type: 'refactor', issues: issues.length });
            report.changed = true;
          }
        }
      }
    } catch (e) {
      report.errors.push(s.type + ': ' + e.message);
      log('error', 'Evolution cycle error: ' + e.message);
    }
  }

  //── Commit jika ada perubahan ──
  if (report.changed) {
    gitCommit.stageAll(ROOT);
    if (gitCommit.hasChanges(ROOT)) {
      const pushed = gitCommit.commitAndPush(ROOT, 'auto-evolution: periodic improvement');
      report.phases.push(pushed.ok ? '📦 Committed ✅' : '📦 Commit gagal');
    }
  }

  return report;
}

function getLog() { return [...LOG]; }

module.exports = { runEvolutionCycle, getLog, log };

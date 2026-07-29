'use strict';

/**
 * Performance & Optimization Engine — Level 9
 * Profiling, optimize, update dependency
 */

const { execSync } = require('child_process');
const { readFileSync, writeFileSync, existsSync } = require('fs');
const { join } = require('path');
const sourceExplorer = require('./source-explorer');
const { ROOT } = require('./source-explorer');

/**
 * Simple profiling — hitung exec time function dari AST
 * Pake Node.js inspector kalo available
 */
function profileFile(filePath) {
  const data = sourceExplorer.readFileSafe(filePath);
  if (!data.ok) return { ok: false, error: data.error };

  const lines = data.content.split('\n');
  const functions = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/(?:async\s+)?function\s+(\w+)/);
    if (m) functions.push({ name: m[1], line: i + 1 });
  }

  return { ok: true, file: filePath, functions, totalLines: lines.length };
}

/**
 * Update dependency ke versi terbaru (patch aja)
 */
function updateDependencies(scope = 'patch') {
  try {
    const cmd = scope === 'major'
      ? 'npx npm-check-updates -u 2>&1'
      : 'npx npm-check-updates -u --target ' + scope + ' 2>&1';
    const out = execSync(cmd, { cwd: ROOT, stdio: 'pipe', timeout: 60000 });
    const output = out.toString().trim();
    return { ok: true, output };
  } catch (e) {
    return { ok: false, error: e.stderr?.toString() || e.message };
  }
}

/**
 * Deteksi bottleneck — cari file dengan loop besar atau nested callbacks
 */
function detectBottlenecks() {
  const files = sourceExplorer.scanSourceFiles();
  const bottlenecks = [];

  for (const f of files) {
    if (f.size < 5000) continue; // skip file kecil
    const data = sourceExplorer.readFileSafe(f.path);
    if (!data.ok) continue;

    const lines = data.content.split('\n');
    const forLoops = lines.filter(l => l.trim().startsWith('for (') || l.trim().startsWith('while (')).length;
    const nestedCallbacks = lines.filter(l => l.includes('function(') && l.includes('function(')).length;

    if (forLoops > 3 || nestedCallbacks > 5) {
      bottlenecks.push({
        file: f.path,
        forLoops,
        nestedCallbacks,
        size: f.size
      });
    }
  }

  return bottlenecks;
}

module.exports = {
  profileFile,
  updateDependencies,
  detectBottlenecks
};

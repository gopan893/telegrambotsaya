'use strict';

/**
 * Source Explorer — memindai struktur proyek, mapping file, deteksi pola
 */

const { readdirSync, statSync, readFileSync } = require('fs');
const { join, relative, basename, extname } = require('path');

const ROOT = join(__dirname, '..', '..');

const IGNORE_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'coverage', 'test', 'tests',
  'scratch', 'public', 'docs', 'assets', 'tmp', '.claude', '.serena'
]);

const IGNORE_FILES = new Set([
  '.DS_Store', 'package-lock.json', 'yarn.lock'
]);

/**
 * Scan semua file JS di src/
 * @returns {Array<{path:string, name:string, dir:string, size:number}>}
 */
function scanSourceFiles() {
  const results = [];

  function walk(dir) {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch (_) { return; }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!IGNORE_DIRS.has(entry.name) && !entry.name.startsWith('.')) walk(full);
      } else if (entry.isFile() && entry.name.endsWith('.js') && !IGNORE_FILES.has(entry.name)) {
        const rel = relative(ROOT, full);
        results.push({
          path: rel,
          name: entry.name,
          dir: relative(ROOT, dir),
          size: statSync(full).size
        });
      }
    }
  }

  walk(join(ROOT, 'src'));
  return results;
}

/**
 * Baca konten file (safe, max 50KB)
 */
function readFileSafe(filePath) {
  const full = join(ROOT, filePath);
  try {
    const stat = statSync(full);
    if (stat.size > 512000) return { ok: false, error: 'FILE_TOO_LARGE', size: stat.size };
    return { ok: true, content: readFileSync(full, 'utf8') };
  } catch (e) {
    return { ok: false, error: e.code || e.message };
  }
}

/**
 * Cari command handler yang sudah ada
 */
function findCommandHandlers(files = null) {
  const targets = files || scanSourceFiles().filter(f => f.name === 'legacy-runtime.js');
  const handlers = [];

  for (const file of targets) {
    const data = readFileSafe(file.path);
    if (!data.ok) continue;
    const lines = data.content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(/resolvedCmd === '(\/[a-z_]+)'/);
      if (m) handlers.push({ cmd: m[1], file: file.path, line: i + 1 });
    }
  }
  return handlers;
}

/**
 * Cari function dengan nama tertentu
 */
function findFunction(name, filePath) {
  const data = readFileSafe(filePath);
  if (!data.ok) return null;
  const lines = data.content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(`async function ${name}`) || lines[i].includes(`function ${name}`)) {
      return { line: i + 1, content: lines[i] };
    }
  }
  return null;
}

module.exports = {
  scanSourceFiles,
  readFileSafe,
  findCommandHandlers,
  findFunction,
  ROOT
};

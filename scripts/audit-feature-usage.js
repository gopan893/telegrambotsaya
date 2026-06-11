#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.resolve(__dirname, '..', 'src');

const IMPORT_RE = /require\(['"]\.\.?\/([^'"]+)['"]\)|require\(['"]\.\.?\/([^'"]+)['"]\)/g;
const IMPORT_SIMPLE = /require\(['"]\.\.?\//;

function collectFiles(dir, baseDir) {
  const entries = [];
  try {
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
      const fullPath = path.join(dir, item.name);
      const relativePath = path.relative(baseDir, fullPath);
      if (item.isDirectory() && !item.name.startsWith('.') && item.name !== 'node_modules') {
        entries.push(...collectFiles(fullPath, baseDir));
      } else if (item.isFile() && (item.name.endsWith('.js'))) {
        entries.push({ path: fullPath, relativePath });
      }
    }
  } catch (_) {}
  return entries;
}

function extractImports(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const imports = [];
  const lines = content.split('\n');
  for (const line of lines) {
    const match = line.match(/require\(['"]\.\.?\/([^'"]+)['"]\)/);
    if (match) {
      imports.push(match[1]);
    }
  }
  return imports;
}

function resolveImport(fromFile, importPath) {
  const dir = path.dirname(fromFile);
  const resolved = path.resolve(dir, importPath);
  const relative = path.relative(SRC_DIR, resolved);
  if (!relative.startsWith('..')) {
    const cleanPath = relative.startsWith('/') ? relative.slice(1) : relative;
    return cleanPath.replace(/\\/g, '/').replace(/\.js$/, '');
  }
  return null;
}

function main() {
  const files = collectFiles(SRC_DIR, SRC_DIR);
  const moduleMap = {};
  const importedBy = {};

  for (const file of files) {
    const key = file.relativePath.replace(/\.js$/, '');
    moduleMap[key] = { path: file.path, relative: file.relativePath, imports: [], importedBy: [] };
    importedBy[key] = [];
  }

  for (const file of files) {
    const key = file.relativePath.replace(/\.js$/, '');
    const imports = extractImports(file.path);
    for (const imp of imports) {
      const resolved = resolveImport(file.path, imp);
      if (resolved && moduleMap[resolved]) {
        moduleMap[key].imports.push(resolved);
        importedBy[resolved].push(key);
      }
    }
  }

  for (const key of Object.keys(moduleMap)) {
    moduleMap[key].importedBy = importedBy[key];
  }

  const orphans = Object.keys(moduleMap).filter(key => moduleMap[key].importedBy.length === 0);

  let output = '# Feature Usage Audit\n\n';
  output += '## Orphan Modules (tidak pernah di-import)\n\n';
  output += 'Modul-modul berikut tidak pernah di-import oleh modul lain di `src/`:\n\n';

  if (orphans.length === 0) {
    output += 'Tidak ada orphan modules.\n';
  } else {
    output += `| Modul | Path |\n|------|------|\n`;
    for (const key of orphans.sort()) {
      output += `| \`${key}\` | \`${moduleMap[key].relative}\` |\n`;
    }
  }

  output += `\n**Total orphan: ${orphans.length} dari ${Object.keys(moduleMap).length} modul**\n\n`;

  output += '## Modul dengan Importer Terbanyak\n\n';
  output += '| Modul | Jumlah Importer |\n|------|:---:|\n';
  const sorted = Object.keys(moduleMap)
    .filter(key => moduleMap[key].importedBy.length > 0)
    .sort((a, b) => moduleMap[b].importedBy.length - moduleMap[a].importedBy.length)
    .slice(0, 20);
  for (const key of sorted) {
    output += `| \`${key}\` | ${moduleMap[key].importedBy.length} |\n`;
  }

  output += '\n## Catatan\n\n';
  output += '- Modul yang di-load via `require()` dinamis atau try/catch mungkin tidak terdeteksi.\n';
  output += '- Orphan module belum tentu tidak dipakai — bisa jadi dipakai via legacy-runtime.js atau entry point lain.\n';
  output += '- Verifikasi manual diperlukan sebelum menghapus modul apapun.\n';

  const outPath = path.resolve(__dirname, '..', 'docs', 'FEATURE_USAGE_AUDIT.md');
  fs.writeFileSync(outPath, output, 'utf8');
  console.log(`Feature usage audit written to ${outPath}`);
  console.log(`Total modules: ${Object.keys(moduleMap).length}`);
  console.log(`Orphan modules: ${orphans.length}`);
}

main();

'use strict';

/**
 * Recursive Self-Improvement Engine — level 8
 * Bot bisa modif self-modify module + generate test suite
 */

const { readFileSync, writeFileSync, existsSync, mkdirSync } = require('fs');
const { join } = require('path');
const sourceExplorer = require('./source-explorer');
const codeGenerator = require('./code-generator');
const gitCommit = require('./git-commit');
const refactorEngine = require('./refactor-engine');
const { ROOT } = require('./source-explorer');

/**
 * Upgrade self-modify module sendiri
 * Deteksi kelemahan di src/self-modify/ → AI generate patch → apply
 */
async function upgradeSelfModify(services) {
  const selfModifyFiles = sourceExplorer.scanSourceFiles()
    .filter(f => f.dir.startsWith('src/self-modify') && f.name.endsWith('.js'))
    .filter(f => !f.name.endsWith('.backup.js'));

  if (selfModifyFiles.length === 0) return { ok: false, error: 'self-modify dir kosong' };

  const results = [];
  for (const file of selfModifyFiles) {
    const data = sourceExplorer.readFileSafe(file.path);
    if (!data.ok) continue;

    // Analisa kualitas
    const issues = refactorEngine.analyzeFile(file.path);
    if (issues.length === 0) {
      results.push({ file: file.path, ok: true, action: 'skip', reason: 'no issues' });
      continue;
    }

    // Fix
    const fixResult = await refactorEngine.refactorPipeline(file.path, services);
    results.push({
      file: file.path,
      ok: fixResult.ok,
      action: fixResult.ok ? 'fixed' : 'failed',
      issues: issues.length,
      error: fixResult.error
    });
  }

  return { ok: true, results };
}

/**
 * Generate test suite untuk file
 * Buat folder test/ + test file + assert sederhana
 */
async function generateTestSuite(filePath, services) {
  const data = sourceExplorer.readFileSafe(filePath);
  if (!data.ok) return { ok: false, error: data.error };

  const testDir = 'test';
  const testFile = filePath
    .replace(/^src\//, '')
    .replace(/\.js$/, '.test.js');

  mkdirSync(join(ROOT, testDir, dirname(testFile)), { recursive: true });

  const prompt = [
    `Buat test suite untuk file ini:`,
    '```js',
    data.content,
    '```',
    '',
    'Aturan:',
    '- CommonJS, require, assert (bukan jest/mocha)',
    '- Setiap exported function harus punya minimal 1 test',
    '- Test real: panggil function, assert output',
    '- Balas HANYA kode, tanpa markdown/backtick',
    '- Simpan di variabel TESTS, export via module.exports',
  ].join('\n');

  const testCode = await services.askAI(
    'Kamu adalah engineer testing. Buat test suite dengan assert.',
    prompt,
    { temperature: 0.2, maxTokens: 3000 }
  );

  if (!testCode || testCode.length < 50) {
    return { ok: false, error: 'Generated test terlalu pendek' };
  }

  const cleaned = testCode
    .replace(/^```(?:js)?\s*|\s*```$/g, '')
    .trim()
    .replace(/require\(['"]\.\.\/\..*?['"]\)/g, m => {
      // Fix relative paths
      return m;
    });

  const fileDir = dirname(filePath);
  const depth = fileDir.split('/').length;
  const prefix = '../'.repeat(depth);
  const adjusted = cleaned
    .replace(/require\(['"]\.\/(.+?)['"]\)/g, (_, name) => `require('${prefix}${fileDir}/${name}')`)
    .replace(/require\(['"]\.\.\/(.+?)['"]\)/g, (_, name) => `require('${prefix}${fileDir}/../${name}')`);

  const fullPath = join(ROOT, testDir, testFile);
  writeFileSync(fullPath, adjusted, 'utf8');

  // Validasi syntax
  const syntax = require('./code-generator').validateSyntax(fullPath);
  if (!syntax.ok) {
    try { require('fs').unlinkSync(fullPath); } catch (_) {}
    return { ok: false, error: `Syntax error: ${syntax.error}` };
  }

  return { ok: true, testFile: `${testDir}/${testFile}` };
}

function dirname(path) {
  const parts = path.split('/');
  parts.pop();
  return parts.join('/');
}

/**
 * Analisa dependency — cek package.json vs require()
 */
function analyzeDependencies() {
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const used = new Set();
  const unused = [];

  const files = sourceExplorer.scanSourceFiles();
  for (const f of files) {
    const data = sourceExplorer.readFileSafe(f.path);
    if (!data.ok) continue;
    for (const depName of Object.keys(deps)) {
      if (data.content.includes(`require('${depName}`) || data.content.includes(`require("${depName}`)) {
        used.add(depName);
      }
    }
  }

  for (const depName of Object.keys(deps)) {
    if (!used.has(depName) && !depName.startsWith('node-') && depName !== 'sharp' && depName !== 'axios') {
      unused.push(depName);
    }
  }

  return { total: Object.keys(deps).length, used: used.size, unused };
}

module.exports = {
  upgradeSelfModify,
  generateTestSuite,
  analyzeDependencies
};

'use strict';

/**
 * Self-Healing Engine — deteksi error production → trace → fix → deploy
 * Level paling advanced: bot sembuhin diri sendiri dari error
 */

const { readFileSync, writeFileSync, existsSync } = require('fs');
const { join } = require('path');
const { execSync } = require('child_process');
const sourceExplorer = require('./source-explorer');
const refactorEngine = require('./refactor-engine');
const gitCommit = require('./git-commit');
const codeGenerator = require('./code-generator');
const { ROOT } = require('./source-explorer');

const ERROR_LOG = [];
const MAX_LOG = 200;

/**
 * Record error dari runtime log
 */
function recordError(source, errorMessage, context) {
  const entry = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    ts: Date.now(),
    source,
    error: errorMessage,
    context: context || '',
    fixed: false
  };
  ERROR_LOG.push(entry);
  if (ERROR_LOG.length > MAX_LOG) ERROR_LOG.shift();
  return entry;
}

/**
 * Trace error ke file & line — cari stack trace pattern
 */
function traceError(errorMessage) {
  // Coba extract file path dari error message
  const fileMatch = errorMessage.match(/(\/src\/[a-zA-Z0-9_/-]+\.js):(\d+)/);
  if (fileMatch) {
    return {
      file: fileMatch[1].replace(/^\//, ''),
      line: parseInt(fileMatch[2]),
      confidence: 'high'
    };
  }

  // Cari by keyword — fallback
  const files = sourceExplorer.scanSourceFiles();
  const keywords = errorMessage.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 4);

  for (const f of files) {
    const data = sourceExplorer.readFileSafe(f.path);
    if (!data.ok) continue;
    const matchCount = keywords.filter(k => data.content.toLowerCase().includes(k)).length;
    if (matchCount > 2) {
      return { file: f.path, line: 0, confidence: 'medium', reason: `keyword match: ${matchCount}/${keywords.length}` };
    }
  }

  return null;
}

/**
 * Fix error pake AI — kirim error + code → AI generate patch
 */
async function healError(entry, services) {
  if (!services?.askAI) return { ok: false, error: 'No AI service' };

  const trace = traceError(entry.error);
  if (!trace) return { ok: false, error: 'Cannot trace error to source' };

  const data = sourceExplorer.readFileSafe(trace.file);
  if (!data.ok) return { ok: false, error: `Cannot read ${trace.file}` };

  const prompt = [
    'Ada error di production. Berikut error dan kode sumber:',
    '',
    `Error: ${entry.error}`,
    ...(entry.context ? [`Context: ${entry.context}`] : []),
    '',
    `File: ${trace.file}`,
    ...(trace.line ? [`Line: ${trace.line}`] : []),
    '',
    'Kode:',
    '```js',
    data.content.slice(Math.max(0, trace.line - 20), trace.line + 30),
    '```',
    '',
    'Buat patch fix. Balas HANYA JSON:',
    '{"fixType":"ubah|tambah|hapus","oldCode":"kode yg salah","newCode":"kode perbaikan","explanation":"penjelasan singkat"}',
    'Atau {"fixType":"none","explanation":"tidak bisa fix otomatis"} jika perlu intervensi manual.'
  ].join('\n');

  const result = await services.askAI(
    'Kamu adalah engineer debug. Analisa error dan buat patch.',
    prompt,
    { temperature: 0.1, maxTokens: 1500 }
  );

  let fix;
  try {
    fix = JSON.parse(result.replace(/```(?:json)?\s*|\s*```/g, '').trim());
  } catch (_) {
    return { ok: false, error: 'Failed to parse AI fix suggestion' };
  }

  if (fix.fixType === 'none') {
    return { ok: false, error: fix.explanation || 'AI suggest manual intervention' };
  }

  // Apply fix
  const fullPath = join(ROOT, trace.file);
  let content = readFileSync(fullPath, 'utf8');

  if (fix.fixType === 'ubah' && fix.oldCode) {
    if (content.includes(fix.oldCode)) {
      content = content.replace(fix.oldCode, fix.newCode || '');
    } else {
      // fuzzy fallback
      return { ok: false, error: 'oldCode not found in file' };
    }
  } else if (fix.fixType === 'tambah') {
    content += '\n' + (fix.newCode || '');
  } else if (fix.fixType === 'hapus' && fix.oldCode) {
    content = content.replace(fix.oldCode, '');
  }

  writeFileSync(fullPath, content, 'utf8');

  // Validasi syntax
  const syntaxValid = codeGenerator.validateSyntax(fullPath);
  if (!syntaxValid.ok) {
    // Rollback
    writeFileSync(fullPath, data.content, 'utf8');
    return { ok: false, error: `Syntax error after fix: ${syntaxValid.error}` };
  }

  entry.fixed = true;
  entry.fixApplied = { file: trace.file, explanation: fix.explanation };

  // Commit
  gitCommit.stageAll(ROOT);
  if (gitCommit.hasChanges(ROOT)) {
    gitCommit.commitAndPush(ROOT, `auto-heal: ${entry.error.slice(0, 50)}`);
  }

  return { ok: true, file: trace.file, explanation: fix.explanation };
}

/**
 * Periodic heal — cek error belum di-fix
 */
async function healAll(services) {
  const pending = ERROR_LOG.filter(e => !e.fixed);
  const results = [];
  for (const entry of pending.slice(0, 5)) {
    const r = await healError(entry, services);
    results.push({ id: entry.id, ok: r.ok, file: r.file || '', error: r.error || r.explanation });
  }
  return { healed: results.filter(r => r.ok).length, failed: results.filter(r => !r.ok).length, results };
}

function getErrors() { return [...ERROR_LOG]; }

module.exports = { recordError, traceError, healError, healAll, getErrors };

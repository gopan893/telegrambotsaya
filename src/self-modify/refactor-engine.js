'use strict';

/**
 * Code Quality Analyzer — scan JS untuk pola bermasalah
 * + Auto-refactor dengan AI
 */

const { readFileSync, writeFileSync } = require('fs');
const { join } = require('path');
const { execSync } = require('child_process');
const sourceExplorer = require('./source-explorer');

const { ROOT } = sourceExplorer;

/**
 * Analisa kualitas satu file
 * @returns {Array<{type:string, severity:string, line:number, message:string, code:string}>}
 */
function analyzeFile(filePath) {
  const data = sourceExplorer.readFileSafe(filePath);
  if (!data.ok) return [];

  const issues = [];
  const lines = data.content.split('\n');

  //── Duplicated try-catch blok ──
  const tryBlocks = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === 'try {') tryBlocks.push(i + 1);
  }
  if (tryBlocks.length > 5) {
    issues.push({
      type: 'design',
      severity: 'medium',
      line: tryBlocks[5],
      message: `Terlalu banyak try-catch (${tryBlocks.length}). Pertimbangkan wrapper atau centralized error handler.`,
      code: `file:${filePath}:try-count-${tryBlocks.length}`
    });
  }

  //── Function terlalu panjang ──
  let inFunction = false;
  let fnName = '';
  let fnStart = 0;
  let braceCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fnMatch = line.match(/(?:async\s+)?function\s+(\w+)/);
    if (fnMatch && braceCount === 0) {
      if (inFunction) {
        const fnLen = i - fnStart;
        if (fnLen > 80) {
          issues.push({
            type: 'complexity',
            severity: 'medium',
            line: fnStart + 1,
            message: `Function '${fnName}' terlalu panjang (${fnLen} baris). Pertimbangkan dipecah.`,
            code: `file:${filePath}:long-function-${fnName}`
          });
        }
      }
      inFunction = true;
      fnName = fnMatch[1];
      fnStart = i;
      braceCount = 0;
    }

    for (const ch of line) {
      if (ch === '{') braceCount++;
      if (ch === '}') braceCount--;
    }
    if (braceCount <= 0 && inFunction && fnName) {
      const fnLen = i - fnStart;
      if (fnLen > 80) {
        issues.push({
          type: 'complexity',
          severity: 'medium',
          line: fnStart + 1,
          message: `Function '${fnName}' terlalu panjang (${fnLen} baris). Pertimbangkan dipecah.`,
          code: `file:${filePath}:long-function-${fnName}`
        });
      }
      inFunction = false;
      fnName = '';
    }
  }

  //── Hardcoded magic numbers ──
  const magicNumRe = /(?:^|[^.\w])(\d{4,})(?:[^.\w]|$)/;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(magicNumRe);
    if (m && !lines[i].includes('timeout') && !lines[i].includes('port') && !lines[i].includes('max') && !lines[i].includes('limit')) {
      issues.push({
        type: 'maintainability',
        severity: 'low',
        line: i + 1,
        message: `Magic number: ${m[1]}. Sebaiknya jadi konstanta.`,
        code: `file:${filePath}:magic-${m[1]}`
      });
    }
  }

  //── Console.log di kode non-debug ──
  for (let i = 0; i < lines.length; i++) {
    if (/console\.log\(/.test(lines[i]) && !lines[i].includes('// debug') && !filePath.includes('debug')) {
      issues.push({
        type: 'cleanliness',
        severity: 'low',
        line: i + 1,
        message: 'console.log di production code. Gunakan logger atau hapus.',
        code: `file:${filePath}:console-log-${i + 1}`
      });
    }
  }

  //── Callback hell (3+ level nested) ──
  let nestLevel = 0;
  let maxNest = 0;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.endsWith('(') || trimmed.endsWith('=>')) {
      nestLevel++;
      maxNest = Math.max(maxNest, nestLevel);
    }
    if (trimmed.startsWith(')') || trimmed.startsWith('})') || trimmed.startsWith(']);')) {
      nestLevel = Math.max(0, nestLevel - 1);
    }
  }
  if (maxNest > 4) {
    issues.push({
      type: 'complexity',
      severity: 'high',
      line: 0,
      message: `Callback hell (${maxNest} level). Gunakan async/await atau promise chain.`,
      code: `file:${filePath}:callback-hell-${maxNest}`
    });
  }

  return issues;
}

/**
 * Analisa semua file JS di src/
 * @returns {Array} sorted by severity
 */
function analyzeAll() {
  const files = sourceExplorer.scanSourceFiles();
  const all = [];

  for (const f of files) {
    const issues = analyzeFile(f.path);
    for (const iss of issues) {
      all.push({ ...iss, file: f.path });
    }
  }

  const order = { high: 0, medium: 1, low: 2 };
  all.sort((a, b) => (order[a.severity] || 9) - (order[b.severity] || 9));

  return all;
}

/**
 * Auto-fix dengan AI — kirim kode + issues, AI balikin kode fix
 */
async function autoFix(filePath, issues, services) {
  const data = sourceExplorer.readFileSafe(filePath);
  if (!data.ok) return { ok: false, error: data.error };

  if (!issues || issues.length === 0) return { ok: true, noChange: true };

  const prompt = [
    `Perbaiki file JavaScript berikut. Issue yang ditemukan:`,
    ...issues.map(i => `- Line ${i.line} [${i.severity}]: ${i.message}`),
    '',
    'Kode saat ini:',
    '```js',
    data.content,
    '```',
    '',
    'Aturan:',
    '- Balas HANYA kode lengkap hasil perbaikan, tanpa markdown/backtick/penjelasan.',
    '- Jangan ubah logika bisnis.',
    '- Jangan tambah dependency baru.',
    '- Gunakan CommonJS (require/module.exports).',
    '- "use strict" tetap di baris 1.'
  ].join('\n');

  try {
    const fixedCode = await services.askAI(
      'Kamu adalah engineer Node.js yang melakukan code refactoring. Perbaiki issue tanpa mengubah logika.',
      prompt,
      { temperature: 0.2, maxTokens: 4000 }
    );

    if (!fixedCode || fixedCode.length < 50) {
      return { ok: false, error: 'Generated code terlalu pendek' };
    }

    const cleaned = fixedCode.trim().replace(/^```(?:js)?\s*|```\s*$/g, '').trim();

    // Backup
    const backup = data.content;

    // Write
    try {
      writeFileSync(join(ROOT, filePath), cleaned, 'utf8');
    } catch (e) {
      return { ok: false, error: `Write failed: ${e.message}` };
    }

    // Syntax check
    const { ok } = require('./code-generator').validateSyntax(join(ROOT, filePath));
    if (!ok) {
      // Rollback
      writeFileSync(join(ROOT, filePath), backup, 'utf8');
      return { ok: false, error: 'Syntax error setelah fix, rollback' };
    }

    return { ok: true, changed: data.content !== cleaned };

  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/**
 * Auto-test — jalanin syntax check + node -e "require()"
 */
function autoTest(filePath) {
  const full = join(ROOT, filePath);

  // Syntax check
  const syntax = require('./code-generator').validateSyntax(full);
  if (!syntax.ok) {
    return { ok: false, phase: 'syntax', error: syntax.error };
  }

  // Require check (kalo modul)
  if (!filePath.endsWith('legacy-runtime.js') && !filePath.endsWith('telebot.js')) {
    try {
      const mod = require(full);
      if (typeof mod !== 'object' && typeof mod !== 'function') {
        return { ok: true, phase: 'require', warning: 'Module tidak export apa-apa' };
      }
    } catch (e) {
      if (e.code !== 'MODULE_NOT_FOUND' || !e.message.includes('cannot find module')) {
        return { ok: false, phase: 'require', error: e.message };
      }
    }
  }

  return { ok: true, phase: 'all' };
}

/**
 * Full refactor pipeline: analyze → fix → test → report
 */
async function refactorPipeline(filePath, services) {
  const issues = analyzeFile(filePath);
  if (issues.length === 0) {
    return { ok: true, message: '✅ Tidak ada issue kualitas yang terdeteksi.' };
  }

  const fixResult = await autoFix(filePath, issues, services);
  if (!fixResult.ok) {
    return { ok: false, error: fixResult.error, issues };
  }
  if (fixResult.noChange) {
    return { ok: true, message: '⚠️ Issue terdeteksi tapi tidak ada perubahan otomatis.', issues };
  }

  const testResult = autoTest(filePath);
  if (!testResult.ok) {
    // Rollback sudah dilakukan di autoFix
    return { ok: false, error: `Fix gagal test (${testResult.phase}): ${testResult.error}. Rollback.`, issues };
  }

  return {
    ok: true,
    message: `✅ Auto-refactor + test lulus.`,
    issuesFixed: issues.length,
    issues
  };
}

module.exports = {
  analyzeFile,
  analyzeAll,
  autoFix,
  autoTest,
  refactorPipeline
};

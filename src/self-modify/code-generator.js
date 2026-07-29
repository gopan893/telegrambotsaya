'use strict';

/**
 * Code Generator — bikin kode baru dari deskripsi natural
 * Panggil AI utk generate, lalu validasi syntax
 */

const { execSync } = require('child_process');
const { writeFileSync } = require('fs');
const { join, dirname } = require('path');
const { ROOT } = require('./source-explorer');

/**
 * Generate kode dari prompt via AI pipeline
 * @param {string} prompt Deskripsi fitur
 * @param {object} services { askAI }
 * @returns {Promise<{ok:boolean, code?:string, error?:string}>}
 */
async function generateFromPrompt(prompt, services) {
  if (typeof services.askAI !== 'function') {
    return { ok: false, error: 'AI service tidak tersedia' };
  }

  const systemPrompt = `Kamu adalah engineer Node.js. Hasilkan kode JavaScript (CommonJS) yang siap pakai.

Aturan:
- Gunakan 'use strict'
- CommonJS (require/module.exports)
- Kode harus lengkap, bukan placeholder
- Jangan gunakan dependency eksternal baru
- Fungsi utama harus async
- Error handling lengkap
- Jangan tambahkan komentar penjelasan berlebihan
- Balas HANYA dengan kode, tanpa markdown atau backtick`;

  try {
    const code = await services.askAI(systemPrompt, prompt, {
      temperature: 0.3,
      maxTokens: 2000
    });

    if (!code || code.length < 50) {
      return { ok: false, error: 'Generated code terlalu pendek' };
    }

    return { ok: true, code: code.trim() };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/**
 * Validasi syntax JS
 */
function validateSyntax(filePath) {
  try {
    execSync(`node --check "${filePath}"`, { stdio: 'pipe', timeout: 10000 });
    return { ok: true };
  } catch (e) {
    const msg = e.stderr ? e.stderr.toString() : e.message;
    return { ok: false, error: msg.split('\n').filter(l => l.includes('SyntaxError') || l.includes('Error')).join('\n') || msg };
  }
}

/**
 * Tulis file baru dengan safety checks
 * @returns {{ok:boolean, path?:string, error?:string}}
 */
function writeNewFile(relativePath, code) {
  const full = join(ROOT, relativePath);

  // Cegah path traversal
  if (full.indexOf(ROOT) !== 0) {
    return { ok: false, error: 'Path traversal ditolak' };
  }

  // Cek file udah ada
  const { existsSync } = require('fs');
  if (existsSync(full)) {
    return { ok: false, error: `File sudah ada: ${relativePath}` };
  }

  try {
    const { mkdirSync } = require('fs');
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, code, 'utf8');
  } catch (e) {
    return { ok: false, error: e.message };
  }

  // Validasi syntax
  const syntax = validateSyntax(full);
  if (!syntax.ok) {
    // Rollback
    try { require('fs').unlinkSync(full); } catch (_) {}
    return { ok: false, error: `Syntax error: ${syntax.error}` };
  }

  return { ok: true, path: relativePath };
}

/**
 * Cari posisi inject di file (setelah baris terakhir yang cocok pattern)
 */
function findInjectPosition(filePath, pattern) {
  const { readFileSync, existsSync } = require('fs');
  const full = join(ROOT, filePath);
  if (!existsSync(full)) return { ok: false, error: 'File tidak ditemukan' };

  const lines = readFileSync(full, 'utf8').split('\n');
  const regex = new RegExp(pattern);
  let lastMatch = -1;
  for (let i = 0; i < lines.length; i++) {
    if (regex.test(lines[i])) lastMatch = i;
  }
  if (lastMatch === -1) return { ok: false, error: 'Pattern tidak ditemukan' };

  return { ok: true, line: lastMatch + 1 };
}

module.exports = {
  generateFromPrompt,
  validateSyntax,
  writeNewFile,
  findInjectPosition
};

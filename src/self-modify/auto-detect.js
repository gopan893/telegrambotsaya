'use strict';

/**
 * Auto-Detect Need — periodic scan log/code, usul improvement tanpa diminta
 */

const { readFileSync } = require('fs');
const { join } = require('path');
const sourceExplorer = require('./source-explorer');
const refactorEngine = require('./refactor-engine');
const { ROOT } = require('./source-explorer');

/**
 * Deteksi peluang improvement dari history chat + code
 * Dipanggil setiap N pesan atau via cron
 */
async function detectImprovements(services) {
  const suggestions = [];

  //── 1. Quality scan — file dengan issue kritis ──
  const allIssues = refactorEngine.analyzeAll();
  const critical = allIssues.filter(i => i.severity === 'high' || i.severity === 'medium');
  const fileCount = new Set(critical.map(i => i.file)).size;

  if (critical.length > 5) {
    suggestions.push({
      type: 'quality',
      priority: 'high',
      summary: `${critical.length} issue kualitas di ${fileCount} file. ${critical[0].file}: ${critical[0].message}`,
      action: 'refactor',
      detail: `Jalankan: /dev refactor atau bot refactor`
    });
  }

  //── 2. Command gap — apakah user sering minta hal yang gak ada ──
  try {
    const logs = readFileSync(join(ROOT, 'src', 'bot', 'legacy-runtime.js'), 'utf8');
    const cmdCount = (logs.match(/resolvedCmd ===/g) || []).length;
    if (cmdCount < 10) {
      suggestions.push({
        type: 'feature',
        priority: 'medium',
        summary: `Hanya ${cmdCount} command handler. Pertimbangkan nambah command utility.`,
        action: 'generate',
        detail: `Contoh: "bot buat command /translate"`
      });
    }
  } catch (_) {}

  //── 3. File dengan ukuran besar ──
  const files = sourceExplorer.scanSourceFiles();
  const largeFiles = files.filter(f => f.size > 100000); // 100KB

  for (const f of largeFiles.slice(0, 3)) {
    suggestions.push({
      type: 'debt',
      priority: 'medium',
      summary: `File besar: ${f.path} (${(f.size / 1024).toFixed(0)}KB). Pecah jadi modul kecil.`,
      action: 'refactor',
      detail: `Bot, refactor ${f.path}`
    });
  }

  //── 4. Missing features (common useful patterns) ──
  const allCode = files
    .map(f => {
      const d = sourceExplorer.readFileSafe(f.path);
      return d.ok ? d.content : '';
    })
    .join('\n');

  const featureChecks = [
    { name: 'reminder', pattern: 'remind', message: 'Belum ada fitur reminder terjadwal.' },
    { name: 'translation', pattern: 'translate', message: 'Belum ada fitur translate.' },
    { name: 'poll', pattern: 'poll', message: 'Belum ada fitur polling/survey.' },
    { name: 'weather', pattern: 'cuaca|weather|openweather', message: 'Belum ada fitur cuaca.' }
  ];

  for (const fc of featureChecks) {
    const re = new RegExp(fc.pattern, 'i');
    if (!re.test(allCode)) {
      suggestions.push({
        type: 'feature',
        priority: 'low',
        summary: fc.message,
        action: 'generate'
      });
    }
  }

  return { suggestions };
}

/**
 * Format hasil deteksi buat dikirim ke user
 */
function formatSuggestions(suggestions) {
  if (!suggestions || suggestions.length === 0) {
    return '✅ Semua terlihat baik. Tidak ada saran improvement.';
  }

  const lines = ['💡 **Saran Improvement Otomatis:**', ''];
  for (const s of suggestions.slice(0, 5)) {
    const icon = s.priority === 'high' ? '🔴' : s.priority === 'medium' ? '🟡' : '🟢';
    lines.push(`${icon} [${s.type}] ${s.summary}`);
    if (s.detail) lines.push(`   → ${s.detail}`);
    lines.push('');
  }

  if (suggestions.length > 5) {
    lines.push(`...dan ${suggestions.length - 5} saran lainnya. Gunakan "bot analisa" untuk detail.`);
  }

  return lines.join('\n');
}

/**
 * Auto-fix dari saran — eksekusi suggestion
 */
async function executeSuggestion(suggestion, services) {
  if (suggestion.action === 'refactor' && suggestion.type === 'quality') {
    // Refactor semua file dengan high issues
    const allIssues = refactorEngine.analyzeAll();
    const high = allIssues.filter(i => i.severity === 'high');
    const fileMap = {};
    for (const iss of high) {
      if (!fileMap[iss.file]) fileMap[iss.file] = [];
      fileMap[iss.file].push(iss);
    }

    const results = [];
    for (const [file, issues] of Object.entries(fileMap).slice(0, 5)) {
      const fixResult = await refactorEngine.refactorPipeline(file, services);
      results.push({ file, ok: fixResult.ok, message: fixResult.message || fixResult.error });
    }
    return results;
  }

  if (suggestion.action === 'generate') {
    return { ok: false, note: 'Butuh prompt user: "bot buat [fitur]"' };
  }

  return [];
}

module.exports = {
  detectImprovements,
  formatSuggestions,
  executeSuggestion
};

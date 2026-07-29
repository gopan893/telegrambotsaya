'use strict';

/**
 * Self-Dev Engine — orchestrate: baca → generate → test → refactor → commit
 */

const sourceExplorer = require('./source-explorer');
const codeGenerator = require('./code-generator');
const gitCommit = require('./git-commit');
const refactorEngine = require('./refactor-engine');
const { ROOT } = require('./source-explorer');

async function selfDev(chatId, userId, prompt, services) {
  const results = [];
  const errors = [];

  function add(label, ok, detail) {
    results.push({ label, ok, detail });
  }

  //── 1. Pahami prompt ──
  add('🔍', true, 'Menganalisis permintaan...');

  const cmdMatch = prompt.match(/^\/dev\s+(.+)/);
  const request = cmdMatch ? cmdMatch[1].trim() : prompt.trim();

  if (!request || request.length < 5) {
    add('❌', false, 'Permintaan terlalu pendek.');
    return { results };
  }

  // Cek intent
  const isGenerate = /^buat|^tambah|^create|^add|^generate|^bikinin|^bikin|^kembangin/i.test(request);
  const isPatch = /^ubah|^patch|^fix|^tambahi|^edit|^modify|^refactor|^perbaiki/i.test(request);
  const isExplore = /^cek|^list|^scan|^explore|^cari|^find|^analisa|^analisis/i.test(request);
  const isRefactor = /^refactor|^quality|^kualitas|^bersihin|^clean/i.test(request);

  if (isExplore) {
    const files = sourceExplorer.scanSourceFiles();
    const handlers = sourceExplorer.findCommandHandlers(files);

    let msg = `📁 **Source Explorer**\n\n`;
    msg += `Total file: ${files.length}\n`;
    msg += `Command handlers: ${handlers.length}\n\n`;
    msg += handlers.slice(0, 20).map(h => `\`${h.cmd}\` — ${h.file}:${h.line}`).join('\n');

    if (handlers.length > 20) msg += `\n...dan ${handlers.length - 20} lainnya`;

    add('📊', true, msg);
    return { results };
  }

  if (isRefactor) {
    //── Refactor mode ──
    add('🔧', true, 'Scan kualitas kode...');
    const allIssues = refactorEngine.analyzeAll();

    if (allIssues.length === 0) {
      add('✅', true, 'Tidak ada issue kualitas.');
      return { results };
    }

    const highIssues = allIssues.filter(i => i.severity === 'high');
    const medIssues = allIssues.filter(i => i.severity === 'medium');

    add('📊', true, `Ditemukan ${allIssues.length} issue (${highIssues.length} high, ${medIssues.length} medium, ${allIssues.length - highIssues.length - medIssues.length} low)`);

    // Fix high + medium priority
    const toFix = [...highIssues, ...medIssues].slice(0, 15);
    const fileGroup = {};
    for (const iss of toFix) {
      if (!fileGroup[iss.file]) fileGroup[iss.file] = [];
      fileGroup[iss.file].push(iss);
    }

    let fixedCount = 0;
    for (const [file, issues] of Object.entries(fileGroup)) {
      add('🔨', true, `Refactor \`${file}\` (${issues.length} issue)...`);
      const fixResult = await refactorEngine.refactorPipeline(file, services);
      if (fixResult.ok) {
        fixedCount += issues.length;
        add('✅', true, fixResult.message);
      } else {
        add('⚠️', false, fixResult.error || 'Gagal refactor');
      }
    }

    if (fixedCount > 0) {
      const repoPath = ROOT;
      gitCommit.stageAll(repoPath);
      if (gitCommit.hasChanges(repoPath)) {
        const pushed = gitCommit.commitAndPush(repoPath, `auto-refactor: ${fixedCount} issue fixed`);
        add('📦', true, pushed.pushed ? 'Committed + pushed ✅' : `Committed (push: ${pushed.error || 'skipped'})`);
      }
    }

    return { results };
  }

  if (isGenerate) {
    //── Generate mode ──
    add('🧠', true, 'Men-generate kode...');
    const gen = await codeGenerator.generateFromPrompt(request, services);
    if (!gen.ok) {
      add('❌', false, `Gagal generate: ${gen.error}`);
      return { results };
    }

    //── Tentukan path file ──
    const nameMatch = request.match(/(?:command|handler|file|modul)\s+(?:\/)?([a-z_/]+)/i);
    let fileName = nameMatch ? nameMatch[1].toLowerCase().replace(/[^a-z0-9_/-]/g, '') : '';
    if (!fileName) {
      const slug = request
        .replace(/^(buat|tambah|create|add|bikinin|bikin|kembangin)\s+/i, '')
        .replace(/[^a-z0-9\s]/gi, '')
        .trim().toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .slice(0, 40);
      fileName = `src/commands/${slug}.js`;
    } else if (!fileName.startsWith('src/')) {
      fileName = `src/commands/${fileName}`;
    }
    if (!fileName.endsWith('.js')) fileName += '.js';

    add('📄', true, `Target: \`${fileName}\``);

    //── Tulis file ──
    const written = codeGenerator.writeNewFile(fileName, gen.code);
    if (!written.ok) {
      add('❌', false, `Gagal tulis: ${written.error}`);
      return { results };
    }
    add('✅', true, `File dibuat: \`${written.path}\``);

    //── Auto-test ──
    add('🧪', true, 'Auto-test...');
    const testResult = refactorEngine.autoTest(written.path);
    if (!testResult.ok) {
      add('❌', false, `Test gagal (${testResult.phase}): ${testResult.error}. Rollback.`);
      // Rollback — delete file
      try { require('fs').unlinkSync(require('path').join(ROOT, written.path)); } catch (_) {}
      return { results };
    }
    add('✅', true, 'Syntax + require OK');

    //── Quality check ──
    add('🔍', true, 'Quality check...');
    const issues = refactorEngine.analyzeFile(written.path);
    if (issues.length > 0) {
      add('⚠️', true, `${issues.length} issue quality ditemukan. Auto-fix...`);
      const fixResult = await refactorEngine.refactorPipeline(written.path, services);
      if (fixResult.ok) {
        add('✅', true, 'Auto-refactor selesai');
      } else {
        add('⚠️', false, `Auto-refactor: ${fixResult.error || 'skip'}`);
      }
    } else {
      add('✅', true, 'Quality OK');
    }

    //── Git commit ──
    const repoPath = ROOT;
    gitCommit.stageAll(repoPath);
    if (gitCommit.hasChanges(repoPath)) {
      const commitMsg = request.slice(0, 60);
      const pushed = gitCommit.commitAndPush(repoPath, commitMsg);
      if (pushed.ok) {
        add('📦', true, pushed.pushed ? 'Committed + pushed ✅' : `Committed (push: ${pushed.error || 'skipped'})`);
      } else {
        add('⚠️', false, `Commit gagal: ${pushed.error}`);
      }
    } else {
      add('📦', true, 'Tidak ada perubahan untuk di-commit');
    }

  } else if (isPatch) {
    add('🔧', true, 'Mode refactor/patch — cari file target...');
    const files = sourceExplorer.scanSourceFiles();
    const keywords = request.replace(/^(ubah|patch|fix|tambahi|edit|modify|refactor|perbaiki)\s+/i, '').toLowerCase().split(/\s+/);
    const candidates = files
      .filter(f => keywords.some(k => f.name.toLowerCase().includes(k)))
      .slice(0, 5);

    if (candidates.length === 0) {
      add('❌', false, `Tidak menemukan file relevan dengan keyword: ${keywords.join(', ')}`);
      return { results };
    }

    // Ambil file pertama, analisa + fix
    const target = candidates[0];
    add('📄', true, `Target: \`${target.path}\``);
    add('🔍', true, 'Analisa kualitas...');

    const issues = refactorEngine.analyzeFile(target.path);
    if (issues.length === 0) {
      add('✅', true, 'Tidak ada issue');
      return { results };
    }

    add('⚠️', true, `${issues.length} issue ditemukan`);
    for (const iss of issues.slice(0, 5)) {
      add('', true, `  [${iss.severity}] L${iss.line}: ${iss.message}`);
    }

    add('🔨', true, 'Auto-fix...');
    const fixResult = await refactorEngine.refactorPipeline(target.path, services);
    if (fixResult.ok) {
      add('✅', true, fixResult.message);
    } else {
      add('❌', false, fixResult.error || 'Gagal');
    }

    if (fixResult.ok && !fixResult.message.includes('Tidak ada')) {
      gitCommit.stageAll(ROOT);
      if (gitCommit.hasChanges(ROOT)) {
        const pushed = gitCommit.commitAndPush(ROOT, `fix: ${target.name} — ${issues.length} issue`);
        add('📦', true, pushed.pushed ? 'Committed + pushed ✅' : `Committed`);
      }
    }
  } else {
    add('❌', false, `Coba:\n  "bot buat fitur [deskripsi]"\n  "bot perbaiki [file]"\n  "bot refactor"\n  "bot cari [keyword]"`);
  }

  return { results };
}

module.exports = { selfDev };

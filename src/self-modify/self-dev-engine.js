'use strict';

/**
 * Self-Dev Engine — orchestrate: baca → generate → patch → commit
 */

const sourceExplorer = require('./source-explorer');
const codeGenerator = require('./code-generator');
const gitCommit = require('./git-commit');
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
    add('❌', false, 'Permintaan terlalu pendek. Contoh: /dev buat command /translate');
    return { results };
  }

  // Cek intent: generate baru atau patch existing
  const isGenerate = /^buat|^tambah|^create|^add|^generate/i.test(request);
  const isPatch = /^ubah|^patch|^fix|^tambahi|^edit|^modify/i.test(request);
  const isExplore = /^cek|^list|^scan|^explore|^cari|^find/i.test(request);

  //── 2. Explore kode ──
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

  if (isGenerate) {
    //── 3. Generate kode AI ──
    add('🧠', true, 'Men-generate kode...');
    const gen = await codeGenerator.generateFromPrompt(request, services);
    if (!gen.ok) {
      add('❌', false, `Gagal generate: ${gen.error}`);
      return { results };
    }

    //── 4. Tentukan path file ──
    // Ekstrak nama file dari prompt atau AI
    const nameMatch = request.match(/(?:command|handler|file|modul)\s+(?:\/)?([a-z_/]+)/i);
    let fileName = nameMatch ? nameMatch[1].toLowerCase().replace(/[^a-z0-9_/-]/g, '') : '';
    if (!fileName) {
      // Generate nama dari request
      const slug = request
        .replace(/^(buat|tambah|create|add)\s+/i, '')
        .replace(/[^a-z0-9\s]/gi, '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .slice(0, 40);
      fileName = `src/commands/${slug}.js`;
    } else if (!fileName.startsWith('src/')) {
      fileName = `src/commands/${fileName}`;
    }
    if (!fileName.endsWith('.js')) fileName += '.js';

    add('📄', true, `Target: \`${fileName}\``);

    //── 5. Tulis file ──
    const written = codeGenerator.writeNewFile(fileName, gen.code);
    if (!written.ok) {
      add('❌', false, `Gagal tulis: ${written.error}`);
      return { results };
    }
    add('✅', true, `File dibuat: \`${written.path}\``);

    //── 6. Git commit ──
    const repoPath = ROOT;
    gitCommit.stageAll(repoPath);
    if (gitCommit.hasChanges(repoPath)) {
      const commitMsg = request.slice(0, 60);
      const pushed = gitCommit.commitAndPush(repoPath, commitMsg);
      if (pushed.ok) {
        add('📦', true, pushed.pushed ? 'Committed + pushed ✅' : `Committed (push skipped: ${pushed.error || 'unknown'})`);
      } else {
        add('⚠️', false, `Commit gagal: ${pushed.error}`);
      }
    } else {
      add('📦', true, 'Tidak ada perubahan untuk di-commit');
    }

  } else if (isPatch) {
    add('🔧', true, 'Mode patch — cari file target...');
    const files = sourceExplorer.scanSourceFiles();
    const keywords = request.replace(/^(ubah|patch|fix|tambahi|edit|modify)\s+/i, '').toLowerCase().split(/\s+/);
    const candidates = files
      .filter(f => keywords.some(k => f.name.toLowerCase().includes(k)))
      .slice(0, 5);

    if (candidates.length === 0) {
      add('❌', false, `Tidak menemukan file relevan dengan keyword: ${keywords.join(', ')}`);
      return { results };
    }

    add('📄', true, `File relevan:\n${candidates.map(c => `  - \`${c.path}\``).join('\n')}`);
    add('💡', true, `Gunakan \`/dev cari <keyword>\` dulu, atau sebut path spesifik.\n\nAtau: /dev patch src/path/file.js <deskripsi>`);
  } else {
    add('❌', false, `Gak paham intent. Gunakan:\n  - /dev buat <deskripsi>\n  - /dev ubah <deskripsi>\n  - /dev cari <keyword>\n  - /dev list`);
  }

  return { results };
}

module.exports = { selfDev };

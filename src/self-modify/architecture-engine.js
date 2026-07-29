'use strict';

/**
 * Architecture Mutability Engine — restruktur file, pindah fungsi, bikin agent baru
 * Level 7: bot bisa reorganisasi kode + create agent Telegram sendiri
 */

const { readFileSync, writeFileSync, mkdirSync, renameSync, unlinkSync, existsSync } = require('fs');
const { join, dirname } = require('path');
const { execSync } = require('child_process');
const sourceExplorer = require('./source-explorer');
const gitCommit = require('./git-commit');

const { ROOT } = sourceExplorer;

/**
 * Pindahkan fungsi antar file
 */
async function moveFunction(funcName, fromFile, toFile, services) {
  const fromData = sourceExplorer.readFileSafe(fromFile);
  if (!fromData.ok) return { ok: false, error: `Gagal baca ${fromFile}` };

  const lines = fromData.content.split('\n');
  let startIdx = -1, endIdx = -1;
  let braceCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes(`function ${funcName}`) || line.includes(`async function ${funcName}`)) {
      startIdx = i;
    }
    if (startIdx !== -1) {
      for (const ch of line) {
        if (ch === '{') braceCount++;
        if (ch === '}') braceCount--;
      }
      if (braceCount === 0 && startIdx !== -1) {
        endIdx = i;
        break;
      }
    }
  }

  if (startIdx === -1 || endIdx === -1) {
    return { ok: false, error: `Function ${funcName} tidak ditemukan` };
  }

  const funcCode = lines.slice(startIdx, endIdx + 1).join('\n');

  // Cek file tujuan
  const toFull = join(ROOT, toFile);
  if (!existsSync(toFull)) {
    return { ok: false, error: `File tujuan tidak ada: ${toFile}` };
  }

  // Append function ke file tujuan
  const toContent = readFileSync(toFull, 'utf8');
  const insertBefore = toContent.lastIndexOf('module.exports');
  if (insertBefore === -1) {
    writeFileSync(toFull, toContent + '\n\n' + funcCode + '\n', 'utf8');
  } else {
    const before = toContent.slice(0, insertBefore);
    const after = toContent.slice(insertBefore);
    writeFileSync(toFull, before + funcCode + '\n\n' + after, 'utf8');
  }

  // Hapus dari file asal
  const newLines = [...lines.slice(0, startIdx), ...lines.slice(endIdx + 1)];
  writeFileSync(join(ROOT, fromFile), newLines.join('\n'), 'utf8');

  return { ok: true, funcName, from: fromFile, to: toFile };
}

/**
 * Buat subfolder baru dan pindahkan file
 */
function restructureFolder(oldPath, newPath) {
  const oldFull = join(ROOT, oldPath);
  const newFull = join(ROOT, newPath);

  if (!existsSync(oldFull)) return { ok: false, error: 'Source tidak ditemukan' };

  mkdirSync(dirname(newFull), { recursive: true });
  renameSync(oldFull, newFull);

  return { ok: true, from: oldPath, to: newPath };
}

/**
 * Buat agent Telegram baru — generate kode + register di config
 * Setiap agent punya token sendiri, role sendiri, bisa jawab di grup
 */
async function createNewAgent(agentConfig, services) {
  const {
    id,
    role,
    name,
    description,
    systemPrompt
  } = agentConfig;

  if (!id || !role) return { ok: false, error: 'id dan role required' };

  const agentDir = `src/agents/${id}`;
  mkdirSync(join(ROOT, agentDir), { recursive: true });

  //── Generate handler ──
  const handlerCode = `'use strict';

/**
 * Agent: ${name || id}
 * Role: ${role}
 * Description: ${description || ''}
 */

const agentPrompt = ${JSON.stringify(systemPrompt || `Kamu adalah agent ${role} AI yang membantu pengguna dengan ${description || 'tugas terkait ' + role}.`)};${''}
  `;

  writeFileSync(join(ROOT, agentDir, 'index.js'), handlerCode, 'utf8');

  return {
    ok: true,
    id,
    role,
    path: agentDir,
    agentCode: handlerCode
  };
}

/**
 * Restruktur command handler terdaftar — pindahin ke file sendiri
 */
function extractCommands(targetFile, services) {
  const data = sourceExplorer.readFileSafe(targetFile);
  if (!data.ok) return { ok: false, error: data.error };

  const lines = data.content.split('\n');
  const cmds = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/resolvedCmd === '(\/[a-z_]+)'/);
    if (m) cmds.push({ cmd: m[1], line: i + 1 });
  }

  return { ok: true, commands: cmds, total: cmds.length };
}

module.exports = {
  moveFunction,
  restructureFolder,
  createNewAgent,
  extractCommands
};

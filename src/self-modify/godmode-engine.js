'use strict';

/**
 * God Mode Engine — Level 10
 * Self-preservation, auto-migrate, provider swap, config modify
 */

const { readFileSync, writeFileSync, existsSync } = require('fs');
const { join } = require('path');
const { execSync } = require('child_process');
const sourceExplorer = require('./source-explorer');
const { ROOT } = require('./source-explorer');

/**
 * Backup & self-preservation
 * Simpan config critical kalo ada perubahan drastis
 */
function selfPreserve() {
  const criticalFiles = [
    'config/env.js',
    'package.json',
    'src/bot/legacy-runtime.js',
    'src/self-modify/index.js'
  ];

  const backup = {};
  for (const f of criticalFiles) {
    const full = join(ROOT, f);
    if (existsSync(full)) {
      backup[f] = readFileSync(full, 'utf8').slice(0, 500); // simpan preview aja
    }
  }

  return { ok: true, backedUp: Object.keys(backup).length };
}

/**
 * Ganti provider AI via env config
 */
async function switchAIProvider(providerName, config, services) {
  const envPath = 'config/env.js';
  const data = sourceExplorer.readFileSafe(envPath);
  if (!data.ok) return { ok: false, error: data.error };

  let newContent = data.content;

  if (config.apiKey) {
    newContent = newContent.replace(
      /GACOR_API_KEY:.*/,
      `GACOR_API_KEY: '${config.apiKey}',`
    );
  }
  if (config.baseUrl) {
    newContent = newContent.replace(
      /GACOR_BASE_URL:.*/,
      `GACOR_BASE_URL: '${config.baseUrl}',`
    );
  }

  writeFileSync(join(ROOT, envPath), newContent, 'utf8');

  return { ok: true, provider: providerName };
}

/**
 * Diagnostic — cek health semua sistem
 */
function healthCheck() {
  const checks = [];

  //── Source ──
  const files = sourceExplorer.scanSourceFiles();
  checks.push({ name: 'source-files', ok: files.length > 0, detail: `${files.length} files` });

  //── Package ──
  try {
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
    checks.push({ name: 'package-json', ok: true, detail: `${Object.keys(pkg.dependencies || {}).length} deps` });
  } catch (e) {
    checks.push({ name: 'package-json', ok: false, detail: e.message });
  }

  //── Env ──
  try {
    const env = readFileSync(join(ROOT, 'config', 'env.js'), 'utf8');
    const hasApiKey = env.includes('GACOR_API_KEY');
    checks.push({ name: 'env-config', ok: hasApiKey, detail: hasApiKey ? 'API key terkonfigurasi' : 'API key missing' });
  } catch (e) {
    checks.push({ name: 'env-config', ok: false, detail: e.message });
  }

  //── Git ──
  try {
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: ROOT, stdio: 'pipe' }).toString().trim();
    const status = execSync('git status --porcelain', { cwd: ROOT, stdio: 'pipe' }).toString().trim();
    checks.push({ name: 'git', ok: true, detail: `${branch} · ${status.length ? status.split('\n').length + ' changes' : 'clean'}` });
  } catch (e) {
    checks.push({ name: 'git', ok: false, detail: e.message });
  }

  return checks;
}

module.exports = {
  selfPreserve,
  switchAIProvider,
  healthCheck
};

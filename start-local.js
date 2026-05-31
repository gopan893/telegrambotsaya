'use strict';

/**
 * start-local.js — Dev startup script yang membaca .env sebelum menjalankan bot
 * Gunakan: node start-local.js
 * Atau:    npm run dev:local
 */

const fs = require('fs');
const path = require('path');

// --- Load .env file secara manual tanpa dotenv dependency ---
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.substring(0, eqIdx).trim();
    const value = trimmed.substring(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  }
  console.log('[startup] .env dimuat dari', envPath);
} else {
  console.warn('[startup] File .env tidak ditemukan. Menggunakan environment variables sistem.');
}

// --- Jalankan bot ---
const { startBotServer } = require('./src/bot');

startBotServer().catch((error) => {
  console.error('[startup] Bot gagal dijalankan:', error.message);
  process.exit(1);
});

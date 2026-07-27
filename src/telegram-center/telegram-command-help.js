'use strict';

const menuRegistry = require('./telegram-menu-registry');

function buildGeneralHelp(actor) {
  const lines = [
    '🤖 Bantuan Telegram AI OS',
    '',
    'Cara menggunakan:',
    '1. Kirim perintah /menu untuk menu utama',
    '2. Kirim /help <perintah> untuk bantuan spesifik',
    '3. Atau kirim pesan seperti ChatGPT',
    '',
    'Contoh chat natural:',
    '• "buat prompt codex untuk fix bug"',
    '• "cek project saya, apa blocker?"',
    '• "bagaimana cara deploy?"',
    '',
    'Keamanan:',
    '• Tindakan berbahaya selalu proposal + approval',
    '• Tidak ada eksekusi langsung',
    '• Rahasia/env tidak pernah ditampilkan',
    '',
    'Perintah tersedia:',
    ''
  ];
  const visible = menuRegistry.listVisibleMenus(actor);
  for (const m of visible) {
    lines.push('/' + m.command + ' — ' + m.description);
  }
  return lines.join('\n');
}

function buildCommandSpecificHelp(command) {
  const cleanCmd = String(command || '').replace(/^\//, '').toLowerCase();
  const menu = menuRegistry.getMenuByCommand(cleanCmd);
  if (!menu) {
    const lines = [
      'Perintah /' + cleanCmd + ' tidak dikenal.',
      'Gunakan /help untuk daftar perintah.'
    ];
    return lines.join('\n');
  }
  const lines = [
    'Bantuan: /' + menu.command,
    '',
    menu.description,
    '',
    'Kategori: ' + menu.category,
    'Risiko: ' + menu.riskLevel
  ];
  if (menu.ownerOnly) lines.push('Akses: Owner only');
  if (menu.adminOnly) lines.push('Akses: Admin only');
  return lines.join('\n');
}

function buildSafetyInfo() {
  const lines = [
    '🔒 Informasi Keamanan',
    '',
    'Bot ini menggunakan sistem keamanan berlapis:',
    '',
    '1. Secret Detection',
    '   Pesan yang mengandung token/env otomatis diblokir.',
    '',
    '2. Risk Classification',
    '   Setiap aksi diklasifikasikan risikonya.',
    '',
    '3. Proposal + Approval',
    '   Tindakan write/external/berbahaya harus melalui proposal.',
    '   Flow: proposal -> evaluation -> approval -> execution',
    '',
    '4. No Auto-Execute',
    '   Tidak ada eksekusi otomatis untuk tindakan berbahaya.',
    '',
    '5. No Secret Exposure',
    '   Token, API key, password tidak pernah ditampilkan.',
    ''
  ];
  return lines.join('\n');
}

function buildApprovalHelp() {
  const lines = [
    '📋 Alur Approval',
    '',
    'Flow:',
    '1. Proposal dibuat (oleh bot atau /propose)',
    '2. Evaluation menilai risiko',
    '3. Owner/admin melakukan /approve <id>',
    '4. Setelah approved, /runexec <id> untuk menjalankan',
    '',
    'Perintah:',
    '/approve <id> — Setujui proposal',
    '/reject <id> <alasan> — Tolak proposal',
    '/runexec <id> — Jalankan proposal yang sudah disetujui',
    '/pending — Lihat proposal menunggu',
    '/proposalstatus <id> — Cek status proposal',
    '',
    'Catatan:',
    '• Hanya owner yang bisa approve/reject',
    '• Approval tidak otomatis menjalankan aksi',
    '• Proposal kedaluwarsa akan ditolak otomatis'
  ];
  return lines.join('\n');
}

module.exports = {
  buildApprovalHelp,
  buildCommandSpecificHelp,
  buildGeneralHelp,
  buildSafetyInfo
};

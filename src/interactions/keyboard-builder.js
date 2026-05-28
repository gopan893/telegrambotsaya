'use strict';

const { button, inlineKeyboard } = require('../utils/telegram-sender');

function mainMenuKeyboard() {
  return inlineKeyboard([
    [button('Chat AI', 'ix:menu:chat'), button('Coding', 'ix:menu:coding')],
    [button('Learning', 'ix:menu:learning'), button('Goals', 'ix:menu:goals')],
    [button('Workflows', 'ix:menu:workflows'), button('Memory', 'ix:menu:memory')],
    [button('Calendar', 'ix:menu:calendar'), button('Ops', 'ix:menu:ops')],
    [button('Settings', 'ix:menu:settings')]
  ]);
}

function codingKeyboard() {
  return inlineKeyboard([
    [button('Buat kode', 'act:code'), button('Debug', 'act:debug')],
    [button('Jelaskan error', 'act:error'), button('Struktur folder', 'act:folder')]
  ]);
}

function codingAuthKeyboard() {
  return inlineKeyboard([
    [button('JWT', 'ix:code:jwt'), button('NextAuth', 'ix:code:nextauth')],
    [button('Session', 'ix:code:session'), button('Supabase Auth', 'ix:code:supabase')]
  ]);
}

function learningKeyboard() {
  return inlineKeyboard([
    [button('Roadmap', 'act:roadmap'), button('Latihan', 'act:exercise')],
    [button('Quiz', 'act:quiz'), button('Jelaskan sederhana', 'act:simple')]
  ]);
}

function decisionKeyboard() {
  return inlineKeyboard([
    [button('Bandingkan opsi', 'act:compare'), button('Lihat risiko', 'act:risk')],
    [button('Rekomendasi', 'act:recommend'), button('Next step', 'act:next')]
  ]);
}

function decisionLensKeyboard() {
  return inlineKeyboard([
    [button('Performa', 'ix:dec:perf'), button('Biaya', 'ix:dec:cost')],
    [button('Use case', 'ix:dec:usecase'), button('Rekomendasi', 'ix:dec:recommend')]
  ]);
}

function opsKeyboard() {
  return inlineKeyboard([
    [button('Cek health', 'act:health'), button('Diagnostics', 'act:diag')],
    [button('Lihat error', 'act:errors'), button('Recovery plan', 'act:recovery')]
  ]);
}

function productKeyboard() {
  return inlineKeyboard([
    [button('Bandingkan', 'act:compare'), button('Ringkas', 'act:summary')],
    [button('Lihat harga', 'act:price'), button('Rekomendasi beli?', 'act:recommend')]
  ]);
}

function wellnessKeyboard() {
  return inlineKeyboard([
    [button('Ringkas', 'act:summary'), button('Tips aman', 'act:wellness_safe')],
    [button('Rencana 7 hari', 'act:wellness_7d'), button('Kapan perlu bantuan', 'act:wellness_help')]
  ]);
}

function confirmationKeyboard(actionId) {
  return inlineKeyboard([
    [button('Ya, lanjutkan', `ix:confirm:yes:${actionId}`), button('Batal', `ix:confirm:no:${actionId}`)]
  ]);
}

function nextActionKeyboard(context = {}) {
  switch (context.type) {
    case 'coding':
      return codingKeyboard();
    case 'learning':
      return learningKeyboard();
    case 'decision':
      return decisionKeyboard();
    case 'wellness':
      return wellnessKeyboard();
    case 'ops':
      return opsKeyboard();
    case 'product':
      return productKeyboard();
    case 'general':
      return inlineKeyboard([
        [button('Ringkas', 'act:summary'), button('Jelaskan lagi', 'act:explain_more')],
        [button('Buat roadmap', 'act:roadmap'), button('Simpan memory', 'act:save_memory')]
      ]);
    default:
      return null;
  }
}

module.exports = {
  codingAuthKeyboard,
  codingKeyboard,
  confirmationKeyboard,
  decisionKeyboard,
  decisionLensKeyboard,
  learningKeyboard,
  mainMenuKeyboard,
  nextActionKeyboard,
  opsKeyboard,
  productKeyboard,
  wellnessKeyboard
};

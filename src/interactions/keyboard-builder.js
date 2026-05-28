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
    [button('Buat kode', 'ix:code:make'), button('Debug', 'ix:code:debug')],
    [button('Jelaskan error', 'ix:code:error'), button('Struktur folder', 'ix:code:structure')]
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
    [button('Roadmap', 'ix:learn:roadmap'), button('Sederhanakan', 'ix:learn:simple')],
    [button('Latihan', 'ix:learn:exercise'), button('Quiz', 'ix:learn:quiz')]
  ]);
}

function decisionKeyboard() {
  return inlineKeyboard([
    [button('Bandingkan opsi', 'ix:dec:compare'), button('Lihat risiko', 'ix:dec:risk')],
    [button('Rekomendasi', 'ix:dec:recommend'), button('Next step', 'ix:dec:next')]
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
    [button('Cek health', 'ix:ops:health'), button('Diagnostics', 'ix:ops:diag')],
    [button('Lihat error', 'ix:ops:errors'), button('Recovery plan', 'ix:ops:recovery')]
  ]);
}

function productKeyboard() {
  return inlineKeyboard([
    [button('Bandingkan', 'ix:qa:compare'), button('Ringkas', 'ix:qa:sum')],
    [button('Lihat harga', 'ix:qa:price'), button('Rekomendasi beli?', 'ix:qa:recommend')]
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
      return /login|auth|jwt|session|nextauth|supabase/i.test(`${context.userText || ''}\n${context.answerText || ''}`)
        ? codingAuthKeyboard()
        : codingKeyboard();
    case 'learning':
      return learningKeyboard();
    case 'decision':
      return decisionKeyboard();
    case 'ops':
      return opsKeyboard();
    case 'product':
      return productKeyboard();
    case 'general':
      return inlineKeyboard([
        [button('Ringkas', 'ix:qa:sum'), button('Jelaskan lagi', 'ix:qa:explain')],
        [button('Buat roadmap', 'ix:qa:roadmap'), button('Simpan memory', 'ix:qa:save')]
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
  productKeyboard
};

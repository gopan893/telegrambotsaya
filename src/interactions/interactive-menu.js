'use strict';

const keyboardBuilder = require('./keyboard-builder');

function replyExtra(messageId, keyboard) {
  return {
    ...(messageId ? { reply_to_message_id: messageId } : {}),
    ...(keyboard ? { reply_markup: keyboard } : {})
  };
}

async function sendMenu(services, chatId, messageId, text, keyboard) {
  if (typeof services.safeSendMessage === 'function') {
    return services.safeSendMessage(chatId, text, replyExtra(messageId, keyboard));
  }
  return false;
}

async function showMainMenu(services, ctx = {}) {
  return sendMenu(
    services,
    ctx.chatId,
    ctx.messageId,
    'Menu utama. Pilih area yang ingin kamu pakai.',
    keyboardBuilder.mainMenuKeyboard()
  );
}

async function showCodingMenu(services, ctx = {}) {
  return sendMenu(
    services,
    ctx.chatId,
    ctx.messageId,
    'Menu coding. Pilih aksi yang paling dekat dengan kebutuhanmu.',
    keyboardBuilder.codingKeyboard()
  );
}

async function showLearningMenu(services, ctx = {}) {
  return sendMenu(
    services,
    ctx.chatId,
    ctx.messageId,
    'Menu learning. Pilih cara belajar yang kamu mau.',
    keyboardBuilder.learningKeyboard()
  );
}

async function showDecisionMenu(services, ctx = {}) {
  return sendMenu(
    services,
    ctx.chatId,
    ctx.messageId,
    'Menu decision support. Pilih sudut analisis.',
    keyboardBuilder.decisionLensKeyboard()
  );
}

async function showMemoryMenu(services, ctx = {}) {
  return sendMenu(
    services,
    ctx.chatId,
    ctx.messageId,
    'Memory. Kamu bisa melihat ringkasan dengan /memori atau menyimpan insight dari tombol "Simpan memory" setelah jawaban AI.',
    keyboardBuilder.nextActionKeyboard({ type: 'general' })
  );
}

async function showOpsMenu(services, ctx = {}) {
  return sendMenu(
    services,
    ctx.chatId,
    ctx.messageId,
    'Menu ops. Pilih pemeriksaan ringan yang ingin dijalankan.',
    keyboardBuilder.opsKeyboard()
  );
}

async function showStaticMenu(services, ctx = {}, key = 'chat') {
  const textByKey = {
    chat: 'Chat AI aktif. Kirim pertanyaan biasa tanpa command.',
    goals: 'Goals tersedia lewat /goals dan /goaladd judul | deskripsi | prioritas.',
    workflows: 'Workflows tersedia lewat /workflows dan /workflowadd judul | deskripsi.',
    calendar: 'Calendar tersedia lewat /auth dan /addevent.',
    settings: 'Settings tersedia lewat /mode, /adaptive status, /savepref, dan /setname.'
  };
  return sendMenu(
    services,
    ctx.chatId,
    ctx.messageId,
    textByKey[key] || 'Menu belum tersedia.',
    keyboardBuilder.mainMenuKeyboard()
  );
}

module.exports = {
  showCodingMenu,
  showDecisionMenu,
  showLearningMenu,
  showMainMenu,
  showMemoryMenu,
  showOpsMenu,
  showStaticMenu
};

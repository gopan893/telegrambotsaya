'use strict';

const markdownSanitizer = require('./telegram-markdown-sanitizer');
const messageSplitter = require('./telegram-message-splitter');

const progressMessages = new Map();

function sendProgressMessage(ctx, message) {
  if (!ctx || !ctx.chatId) return null;
  const chatId = ctx.chatId;
  const safeMsg = markdownSanitizer.sanitizeTelegramMarkdown(String(message).slice(0, 500));
  const key = String(chatId) + ':progress';
  if (progressMessages.has(key)) {
    return updateProgressMessage(ctx, message);
  }
  const msgId = ctx.sendMessage ? Date.now() : null;
  progressMessages.set(key, { msgId, text: safeMsg, ts: Date.now() });
  return msgId;
}

function updateProgressMessage(ctx, message) {
  if (!ctx || !ctx.chatId) return false;
  const chatId = ctx.chatId;
  const key = String(chatId) + ':progress';
  const existing = progressMessages.get(key);
  const safeMsg = markdownSanitizer.sanitizeTelegramMarkdown(String(message).slice(0, 500));
  if (existing && existing.msgId && ctx.editMessageText) {
    try {
      ctx.editMessageText(safeMsg);
      existing.text = safeMsg;
      existing.ts = Date.now();
      return true;
    } catch (_) {
      existing.text = safeMsg;
      existing.ts = Date.now();
      return false;
    }
  }
  progressMessages.set(key, { msgId: null, text: safeMsg, ts: Date.now() });
  return false;
}

function presentLongTaskStarted(ctx, task) {
  if (!ctx || !ctx.chatId) return { parts: ['Memproses...'] };
  const message = 'Memproses: ' + (task || 'tugas') + '...';
  const parts = messageSplitter.splitTelegramMessage(message);
  return { parts, keyboard: null };
}

function presentLongTaskCompleted(ctx, result) {
  if (!ctx || !ctx.chatId) return { parts: ['Selesai.'] };
  const text = result && typeof result === 'string' ? result : (result ? result.summary || result.text || 'Selesai.' : 'Selesai.');
  const message = 'Selesai.\n\n' + text;
  const parts = messageSplitter.splitTelegramMessage(message);
  return { parts, keyboard: null };
}

function presentLongTaskFailed(ctx, error) {
  if (!ctx || !ctx.chatId) return { parts: ['Gagal.'] };
  const msg = error && error.message ? error.message : (error ? String(error) : 'Kesalahan tidak diketahui');
  const safeMsg = markdownSanitizer.redactSecrets(msg).slice(0, 500);
  const message = 'Gagal.\n\n' + safeMsg + '\n\nCoba lagi atau hubungi admin.';
  const parts = messageSplitter.splitTelegramMessage(message);
  return { parts, keyboard: null };
}

function clearProgress(chatId) {
  const key = String(chatId) + ':progress';
  progressMessages.delete(key);
}

module.exports = {
  clearProgress,
  presentLongTaskCompleted,
  presentLongTaskFailed,
  presentLongTaskStarted,
  sendProgressMessage,
  updateProgressMessage
};

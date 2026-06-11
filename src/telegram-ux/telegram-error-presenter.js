'use strict';

const markdownSanitizer = require('./telegram-markdown-sanitizer');
const replyTemplate = require('./telegram-reply-template');
const inlineKeyboardBuilder = require('./telegram-inline-keyboard-builder');
const messageSplitter = require('./telegram-message-splitter');
const uxStore = require('./telegram-ux-store');

function presentTelegramError(error, context) {
  const msg = error && error.message ? error.message : (error ? String(error) : 'Unknown error');
  const safeMsg = markdownSanitizer.redactSecrets(msg).slice(0, 500);
  const template = replyTemplate.renderTemplate('error_safe', { message: safeMsg });
  const parts = messageSplitter.splitTelegramMessage(template);
  const keyboard = inlineKeyboardBuilder.buildSafeBackKeyboard();
  return { parts, keyboard, safe: true };
}

function presentSafeUserError(message, context) {
  if (!message) return presentTelegramError(new Error('Unknown error'), context);
  const safeMsg = markdownSanitizer.redactSecrets(String(message)).slice(0, 500);
  const lines = ['Maaf, ' + safeMsg];
  if (context && context.suggestion) lines.push('', context.suggestion);
  const text = lines.join('\n');
  const parts = messageSplitter.splitTelegramMessage(text);
  const keyboard = inlineKeyboardBuilder.buildSafeBackKeyboard();
  return { parts, keyboard };
}

function presentModuleDegraded(moduleName, reason) {
  const template = replyTemplate.renderTemplate('degraded_module', {
    moduleName: moduleName || 'Modul',
    reason: reason || 'tidak diketahui'
  });
  const parts = messageSplitter.splitTelegramMessage(template);
  const keyboard = inlineKeyboardBuilder.buildSafeBackKeyboard();
  return { parts, keyboard };
}

function presentPermissionDenied(reason) {
  const text = reason || 'Anda tidak memiliki izin untuk melakukan tindakan ini.';
  const parts = messageSplitter.splitTelegramMessage(text);
  const keyboard = inlineKeyboardBuilder.buildSafeBackKeyboard();
  return { parts, keyboard };
}

function presentApprovalRequired(action) {
  const template = replyTemplate.renderTemplate('approval_required', {
    action: action || 'tindakan ini',
    reason: 'Tindakan ini memerlukan persetujuan owner.',
    proposalId: '?'
  });
  const parts = messageSplitter.splitTelegramMessage(template);
  const keyboard = inlineKeyboardBuilder.buildSafeBackKeyboard();
  return { parts, keyboard };
}

module.exports = {
  presentApprovalRequired,
  presentModuleDegraded,
  presentPermissionDenied,
  presentSafeUserError,
  presentTelegramError
};

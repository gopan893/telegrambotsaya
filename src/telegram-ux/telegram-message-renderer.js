'use strict';

const markdownSanitizer = require('./telegram-markdown-sanitizer');
const messageSplitter = require('./telegram-message-splitter');
const codeBlockFormatter = require('./telegram-code-block-formatter');
const inlineKeyboardBuilder = require('./telegram-inline-keyboard-builder');
const replyTemplate = require('./telegram-reply-template');
const uxStore = require('./telegram-ux-store');

function renderTelegramReply(input, options) {
  if (!input) {
    const fallback = replyTemplate.renderTemplate('normal_chat', { message: 'Tidak ada tanggapan.' });
    return { parts: splitAndSanitize(fallback, options), keyboard: null };
  }
  const text = typeof input === 'string' ? input : (input.text || input.message || '');
  const template = replyTemplate.renderTemplate('normal_chat', { message: text });
  const parts = splitAndSanitize(template, options);
  const keyboard = options && options.keyboard ? options.keyboard : (input.keyboard || null);
  return { parts, keyboard };
}

function renderShortAnswer(input, options) {
  if (!input) return { text: 'Tidak ada data.', keyboard: null };
  const text = typeof input === 'string' ? input : (input.text || input.message || input.summary || '');
  const maxLen = (options && options.maxLength) || 500;
  const sanitized = markdownSanitizer.sanitizeTelegramMarkdown(String(text).slice(0, maxLen));
  const parts = [sanitized];
  const keyboard = options && options.keyboard ? options.keyboard : null;
  return { parts, keyboard };
}

function renderDetailedAnswer(input, options) {
  if (!input) return { parts: ['Tidak ada data detail.'], keyboard: null };
  const text = typeof input === 'string' ? input : (input.detail || input.text || input.message || '');
  const template = replyTemplate.renderTemplate('normal_chat', { message: text });
  const parts = splitAndSanitize(template, options);
  const keyboard = options && options.keyboard ? options.keyboard : null;
  return { parts, keyboard };
}

function renderActionSummary(input, options) {
  if (!input) return { parts: ['Tidak ada ringkasan aksi.'], keyboard: null };
  const action = typeof input === 'string' ? input : (input.action || input.summary || input.text || '');
  const status = input && input.status ? input.status : 'selesai';
  const template = replyTemplate.renderTemplate('task_plan', {
    title: 'Ringkasan Aksi',
    summary: action,
    status: status
  });
  const parts = splitAndSanitize(template, options);
  const keyboard = options && options.keyboard ? options.keyboard : null;
  return { parts, keyboard };
}

function renderSafeError(error, options) {
  const msg = error && error.message ? error.message : (error ? String(error) : 'Maaf, saya mengalami kendala internal.');
  const safeMsg = markdownSanitizer.redactSecrets(msg);
  const context = options && options.context ? options.context : {};
  const template = replyTemplate.renderTemplate('error_safe', {
    message: safeMsg,
    context: JSON.stringify(context)
  });
  const parts = splitAndSanitize(template, options);
  return { parts, keyboard: inlineKeyboardBuilder.buildSafeBackKeyboard() };
}

function renderDegradedNotice(message, options) {
  if (!message) return { parts: ['Modul tidak tersedia.'], keyboard: null };
  const template = replyTemplate.renderTemplate('degraded_module', {
    moduleName: options && options.moduleName ? options.moduleName : 'Modul',
    reason: message
  });
  const parts = splitAndSanitize(template, options);
  return { parts, keyboard: inlineKeyboardBuilder.buildSafeBackKeyboard() };
}

function renderProposalSummary(proposal, options) {
  if (!proposal) return { parts: ['Tidak ada proposal.'], keyboard: null };
  const template = replyTemplate.renderTemplate('proposal_created', {
    proposalId: proposal.id || 'unknown',
    action: proposal.action || proposal.command || 'unknown',
    riskLevel: proposal.riskLevel || 'read_only',
    status: proposal.status || 'pending',
    details: proposal.details || ''
  });
  const parts = splitAndSanitize(template, options);
  const keyboard = inlineKeyboardBuilder.buildApprovalKeyboard(proposal.id);
  return { parts, keyboard };
}

function renderStatusCard(status, options) {
  if (!status) return { parts: ['Tidak ada status.'], keyboard: null };
  const lines = ['📊 Status'];
  if (status.bot) lines.push('Bot: ' + status.bot);
  if (status.ai) lines.push('AI: ' + status.ai);
  if (status.storage) lines.push('Storage: ' + status.storage);
  if (status.pendingApprovals !== undefined) lines.push('Pending: ' + status.pendingApprovals);
  if (status.lastError) lines.push('Error: ' + markdownSanitizer.redactSecrets(String(status.lastError).slice(0, 200)));
  const text = lines.join('\n');
  const parts = splitAndSanitize(text, options);
  const keyboard = inlineKeyboardBuilder.buildStatusKeyboard();
  return { parts, keyboard };
}

function splitAndSanitize(text, options) {
  const sanitized = markdownSanitizer.sanitizeTelegramMarkdown(text);
  return messageSplitter.splitTelegramMessage(sanitized, options);
}

module.exports = {
  renderActionSummary,
  renderDegradedNotice,
  renderDetailedAnswer,
  renderProposalSummary,
  renderSafeError,
  renderShortAnswer,
  renderStatusCard,
  renderTelegramReply
};

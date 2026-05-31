'use strict';

const guards = require('./conversation-guards');

const DEFAULT_MAX_MESSAGES = 8;
const DEFAULT_TTL_MS = 45 * 60 * 1000;

function makeKey(userId, chatId) {
  return `${guards.safeText(userId)}:${guards.safeText(chatId)}`;
}

class ContextWindow {
  constructor(options = {}) {
    this.maxMessages = Number(options.maxMessages || DEFAULT_MAX_MESSAGES);
    this.ttlMs = Number(options.ttlMs || DEFAULT_TTL_MS);
    this.windows = new Map();
  }

  ensure(userId, chatId) {
    const key = makeKey(userId, chatId);
    if (!this.windows.has(key)) {
      this.windows.set(key, {
        userId: guards.safeText(userId),
        chatId: guards.safeText(chatId),
        messages: [],
        activeTopic: '',
        lastIntent: '',
        shortSummary: '',
        updatedAt: guards.nowMs(),
        expiresAt: guards.nowMs() + this.ttlMs
      });
    }
    return this.windows.get(key);
  }

  get(userId, chatId) {
    return this.ensure(userId, chatId);
  }

  record(userId, chatId, role, text, meta = {}) {
    const win = this.ensure(userId, chatId);
    const clean = guards.compactText(text, 1000);
    if (!clean) return win;

    win.messages.push({
      role,
      text: clean,
      intent: meta.intent || '',
      topic: meta.topic || '',
      createdAt: guards.nowMs()
    });

    if (meta.topic) {
      win.activeTopic = guards.compactText(meta.topic, 120);
    } else if (role === 'user' && guards.isFreshTopicCandidate(clean)) {
      win.activeTopic = guards.extractTopic(clean, win.activeTopic || 'topik aktif');
    }

    if (meta.intent) {
      win.lastIntent = meta.intent;
    }

    win.messages = win.messages.slice(-this.maxMessages);
    win.shortSummary = this.summarize(win);
    win.updatedAt = guards.nowMs();
    win.expiresAt = win.updatedAt + this.ttlMs;
    this.cleanupExpiredContext();
    return win;
  }

  recordUserMessage(userId, chatId, text, meta = {}) {
    return this.record(userId, chatId, 'user', text, meta);
  }

  recordBotMessage(userId, chatId, text, meta = {}) {
    return this.record(userId, chatId, 'assistant', text, meta);
  }

  summarize(win) {
    const lastPairs = win.messages.slice(-4).map((message) => {
      const label = message.role === 'assistant' ? 'Bot' : 'User';
      return `${label}: ${guards.compactText(message.text, 180)}`;
    });
    return lastPairs.join('\n');
  }

  getLast(role, userId, chatId) {
    const win = this.ensure(userId, chatId);
    return [...win.messages].reverse().find(message => message.role === role) || null;
  }

  hasEnoughContext(userId, chatId) {
    const win = this.ensure(userId, chatId);
    return Boolean(win.activeTopic || win.messages.length >= 2);
  }

  buildPromptContext(userId, chatId, pending = null) {
    const win = this.ensure(userId, chatId);
    const lastUser = this.getLast('user', userId, chatId);
    const lastBot = this.getLast('assistant', userId, chatId);

    return [
      `Topik aktif: ${win.activeTopic || pending?.topic || '-'}`,
      `Intent terakhir: ${win.lastIntent || pending?.type || '-'}`,
      pending ? `Pending action: ${pending.type} tentang ${pending.topic || pending.query || '-'}` : 'Pending action: -',
      lastUser ? `Pesan user terakhir: ${guards.compactText(lastUser.text, 220)}` : '',
      lastBot ? `Jawaban bot terakhir: ${guards.compactText(lastBot.text, 300)}` : '',
      win.shortSummary ? `Ringkasan window:\n${win.shortSummary}` : ''
    ].filter(Boolean).join('\n');
  }

  clear(userId, chatId) {
    this.windows.delete(makeKey(userId, chatId));
  }

  cleanupExpiredContext() {
    const now = guards.nowMs();
    for (const [key, win] of this.windows.entries()) {
      if (now > Number(win.expiresAt || 0)) this.windows.delete(key);
    }
  }
}

const singleton = new ContextWindow();

function addMessage(userId, chatId, role, content, meta = {}) {
  return singleton.record(userId, chatId, role, content, meta);
}

function getContextWindow(userId, chatId) {
  return singleton.get(userId, chatId);
}

function summarizeContextWindow(messagesOrWindow) {
  const win = Array.isArray(messagesOrWindow)
    ? { messages: messagesOrWindow }
    : messagesOrWindow;
  return singleton.summarize(win || { messages: [] });
}

function clearContextWindow(userId, chatId) {
  return singleton.clear(userId, chatId);
}

function cleanupExpiredContext() {
  return singleton.cleanupExpiredContext();
}

module.exports = {
  addMessage,
  cleanupExpiredContext,
  clearContextWindow,
  ContextWindow,
  createContextWindow: (options) => new ContextWindow(options),
  getContextWindow,
  summarizeContextWindow
};

'use strict';

const guards = require('./conversation-guards');

const DEFAULT_TTL_MS = 10 * 60 * 1000;
const MAX_PENDING = 500;

function makeKey(userId, chatId) {
  return `${guards.safeText(userId)}:${guards.safeText(chatId)}`;
}

function createId() {
  return `pa_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

class PendingActions {
  constructor(options = {}) {
    this.ttlMs = Number(options.ttlMs || DEFAULT_TTL_MS);
    this.items = new Map();
  }

  create(input = {}) {
    const now = guards.nowMs();
    const action = {
      id: input.id || createId(),
      userId: guards.safeText(input.userId),
      chatId: guards.safeText(input.chatId),
      type: input.type || 'conversation_continuation',
      topic: guards.compactText(input.topic || input.query || 'topik sebelumnya', 140),
      query: guards.compactText(input.query || input.topic || '', 400),
      payload: input.payload || {},
      createdAt: input.createdAt || now,
      expiresAt: input.expiresAt || now + this.ttlMs,
      status: input.status || 'active'
    };

    this.items.set(makeKey(action.userId, action.chatId), action);
    this.prune();
    return action;
  }

  get(userId, chatId) {
    const key = makeKey(userId, chatId);
    const action = this.items.get(key);
    if (!action) return null;
    if (this.isExpired(action)) {
      this.items.delete(key);
      return null;
    }
    return action;
  }

  clear(userId, chatId, status = 'cleared') {
    const key = makeKey(userId, chatId);
    const action = this.items.get(key);
    if (action) {
      action.status = status;
      action.updatedAt = guards.nowMs();
    }
    this.items.delete(key);
    return action || null;
  }

  complete(userId, chatId) {
    return this.clear(userId, chatId, 'completed');
  }

  isExpired(action) {
    return !action || action.status !== 'active' || guards.nowMs() > Number(action.expiresAt || 0);
  }

  prune() {
    for (const [key, action] of this.items.entries()) {
      if (this.isExpired(action)) {
        this.items.delete(key);
      }
    }

    if (this.items.size <= MAX_PENDING) return;
    const sorted = Array.from(this.items.entries())
      .sort((a, b) => Number(a[1].createdAt || 0) - Number(b[1].createdAt || 0));
    for (const [key] of sorted.slice(0, this.items.size - MAX_PENDING)) {
      this.items.delete(key);
    }
  }

  inferFromBotReply(input = {}) {
    const userId = input.userId;
    const chatId = input.chatId;
    const userText = guards.safeText(input.userText);
    const botText = guards.safeText(input.botText);
    if (!userId || !chatId || !botText) return null;

    const lower = guards.safeLower(botText);
    const openEndedQuestion = /(^|\s)(apa yang|bagaimana|gimana|kenapa|mengapa|siapa|kapan|dimana|berapa|what|why|how|when|where|who)\b/.test(lower);
    const asksYesNoQuestion = lower.includes('?') && !openEndedQuestion && guards.includesAny(lower, [
      'mau', 'boleh', 'ingin', 'perlu', 'apakah', 'setuju', 'lanjut',
      'do you want', 'want me', 'should i', 'shall i', 'would you like'
    ]);
    const asksPermission = guards.includesAny(lower, [
      'mau aku', 'boleh aku', 'ingin aku', 'apakah kamu mau', 'aku lanjut',
      'ingin saya', 'shall i', 'do you want', 'should i', 'mau saya'
    ]);
    const asksContinuation = guards.includesAny(lower, [
      'ketik lanjut', 'balas lanjut', 'lanjut?', 'mau lanjut', 'lanjutkan?'
    ]);

    if (!asksYesNoQuestion && !asksPermission && !asksContinuation) {
      return null;
    }

    const type = guards.includesAny(lower, ['cari', 'search', 'info', 'riset'])
      ? 'search_confirmation'
      : asksContinuation
        ? 'step_continuation'
        : 'conversation_confirmation';

    const topic = guards.extractTopic(botText, guards.extractTopic(userText, 'topik sebelumnya'));

    return this.create({
      userId,
      chatId,
      type,
      topic,
      query: topic,
      payload: {
        sourceUserText: guards.compactText(userText, 500),
        sourceBotAnswer: guards.compactText(botText, 700),
        intent: input.intent || ''
      }
    });
  }
}

module.exports = {
  PendingActions,
  createPendingActions: (options) => new PendingActions(options)
};

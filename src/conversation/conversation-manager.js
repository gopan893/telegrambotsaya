'use strict';

const { createPendingActions } = require('./pending-actions');
const followupDetector = require('./followup-detector');
const topicShiftDetector = require('./topic-shift-detector');
const { createContextWindow } = require('./context-window');
const continuationHandler = require('./continuation-handler');
const clarificationHandler = require('./clarification-handler');
const guards = require('./conversation-guards');

function makeNormalDecision(contextWindow, userId, chatId, reason = 'normal_chat') {
  return {
    action: 'normal',
    reason,
    promptContext: contextWindow.buildPromptContext(userId, chatId),
    instruction: 'Jawab pesan user secara natural seperti AI assistant modern. Gunakan konteks percakapan hanya jika relevan; jika user jelas mengganti topik, ikuti topik baru.'
  };
}

class ConversationManager {
  constructor(options = {}) {
    this.pendingActions = options.pendingActions || createPendingActions(options.pendingOptions);
    this.contextWindow = options.contextWindow || createContextWindow(options.contextOptions);
  }

  prepare(input = {}) {
    const userId = input.userId;
    const chatId = input.chatId;
    const text = guards.safeText(input.text);
    const command = guards.safeText(input.command);

    if (command) {
      return { action: 'command', reason: 'telegram_command_priority' };
    }

    const previousContext = this.contextWindow.get(userId, chatId);
    const pending = this.pendingActions.get(userId, chatId);
    const followup = followupDetector.detect(text);
    const hasContext = this.contextWindow.hasEnoughContext(userId, chatId);

    if (pending) {
      const shift = topicShiftDetector.detectTopicShift({
        text,
        pending,
        context: previousContext,
        followup
      });

      if (shift.shifted) {
        this.pendingActions.clear(userId, chatId, 'topic_shift');
        this.contextWindow.recordUserMessage(userId, chatId, text, {
          topic: guards.extractTopic(text, previousContext.activeTopic),
          intent: 'topic_shift'
        });
        return makeNormalDecision(this.contextWindow, userId, chatId, `topic_shift:${shift.reason}`);
      }

      if (followup.kind === 'deny' || followup.kind === 'cancel') {
        this.pendingActions.clear(userId, chatId, followup.kind === 'cancel' ? 'cancelled' : 'denied');
        this.contextWindow.recordUserMessage(userId, chatId, text, { intent: 'pending_cancelled' });
        return {
          action: 'direct',
          reason: 'pending_action_cancelled',
          responseText: 'Oke, saya batalkan. Kita bisa lanjut ke topik lain kapan saja.'
        };
      }

      if (['affirm', 'continue', 'referential'].includes(followup.kind)) {
        this.contextWindow.recordUserMessage(userId, chatId, text, {
          topic: pending.topic,
          intent: `pending_${followup.kind}`
        });
        return continuationHandler.buildContinuation({
          text,
          pending,
          context: previousContext,
          followup,
          promptContext: this.contextWindow.buildPromptContext(userId, chatId, pending)
        });
      }
    }

    if (clarificationHandler.needsClarification({
      text,
      followup,
      pending,
      hasContext
    })) {
      this.contextWindow.recordUserMessage(userId, chatId, text, { intent: 'clarification_needed' });
      return {
        action: 'direct',
        reason: 'ambiguous_followup_without_context',
        responseText: clarificationHandler.buildClarification({ text })
      };
    }

    if (!pending && ['continue', 'referential'].includes(followup.kind) && hasContext) {
      this.contextWindow.recordUserMessage(userId, chatId, text, {
        topic: previousContext.activeTopic,
        intent: `context_${followup.kind}`
      });
      return continuationHandler.buildContinuation({
        text,
        pending: null,
        context: previousContext,
        followup,
        promptContext: this.contextWindow.buildPromptContext(userId, chatId)
      });
    }

    const topic = guards.isFreshTopicCandidate(text)
      ? guards.extractTopic(text, previousContext.activeTopic)
      : previousContext.activeTopic;
    this.contextWindow.recordUserMessage(userId, chatId, text, {
      topic,
      intent: 'normal_chat'
    });

    return makeNormalDecision(this.contextWindow, userId, chatId);
  }

  recordBotReply(input = {}) {
    const userId = input.userId;
    const chatId = input.chatId;
    const botText = guards.safeText(input.botText);
    if (!userId || !chatId || !botText) return null;

    const inferred = this.pendingActions.inferFromBotReply({
      userId,
      chatId,
      userText: input.userText,
      botText,
      intent: input.intent
    });

    this.contextWindow.recordBotMessage(userId, chatId, botText, {
      topic: inferred?.topic || input.topic || '',
      intent: input.intent || inferred?.type || 'assistant_reply'
    });

    return inferred;
  }

  clearUser(userId, chatId) {
    this.pendingActions.clear(userId, chatId, 'manual_clear');
    this.contextWindow.clear(userId, chatId);
  }
}

function createConversationManager(options = {}) {
  return new ConversationManager(options);
}

module.exports = createConversationManager();
module.exports.ConversationManager = ConversationManager;
module.exports.createConversationManager = createConversationManager;

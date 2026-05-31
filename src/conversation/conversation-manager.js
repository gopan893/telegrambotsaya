'use strict';

const { createPendingActions } = require('./pending-actions');
const followupDetector = require('./followup-detector');
const topicShiftDetector = require('./topic-shift-detector');
const { createContextWindow } = require('./context-window');
const continuationHandler = require('./continuation-handler');
const clarificationHandler = require('./clarification-handler');
const guards = require('./conversation-guards');
const dialogueState = require('./dialogue-state');

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
    const shift = topicShiftDetector.detectTopicShift({
      text,
      pending,
      context: previousContext,
      followup
    });

    if (pending) {
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
      dialogueState.addDialogueMessage(userId, chatId, 'user', text, { intent: 'clarification_needed' });
      return {
        action: 'direct',
        reason: 'ambiguous_followup_without_context',
        responseText: clarificationHandler.buildClarification({ text })
      };
    }

    if (!pending && followup.kind === 'affirm') {
      this.contextWindow.recordUserMessage(userId, chatId, text, {
        topic: previousContext.activeTopic,
        intent: 'ambiguous_affirmative'
      });
      dialogueState.addDialogueMessage(userId, chatId, 'user', text, {
        topic: previousContext.activeTopic,
        intent: 'ambiguous_affirmative'
      });
      return {
        action: 'direct',
        reason: pending ? 'unexpected_pending_state' : 'ambiguous_affirmative_without_pending',
        responseText: previousContext.activeTopic
          ? `Maksudnya iya untuk melanjutkan bagian "${previousContext.activeTopic}", atau ada hal lain yang kamu maksud?`
          : 'Maksudnya iya untuk bagian yang mana? Kirim sedikit konteks, atau tulis langsung apa yang ingin kamu lanjutkan.'
      };
    }

    if (!pending && ['continue', 'referential'].includes(followup.kind) && hasContext) {
      this.contextWindow.recordUserMessage(userId, chatId, text, {
        topic: previousContext.activeTopic,
        intent: `context_${followup.kind}`
      });
      dialogueState.addDialogueMessage(userId, chatId, 'user', text, {
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

    if (!pending && shift.shifted) {
      this.contextWindow.recordUserMessage(userId, chatId, text, {
        topic: shift.newTopic || guards.extractTopic(text, previousContext.activeTopic),
        intent: shift.newIntent || 'topic_shift'
      });
      dialogueState.addDialogueMessage(userId, chatId, 'user', text, {
        topic: shift.newTopic,
        intent: shift.newIntent || 'topic_shift'
      });
      return {
        ...makeNormalDecision(this.contextWindow, userId, chatId, `topic_shift:${shift.reason}`),
        action: 'new_topic',
        newTopic: shift.newTopic,
        newIntent: shift.newIntent
      };
    }

    const topic = guards.isFreshTopicCandidate(text)
      ? guards.extractTopic(text, previousContext.activeTopic)
      : previousContext.activeTopic;
    this.contextWindow.recordUserMessage(userId, chatId, text, {
      topic,
      intent: 'normal_chat'
    });
    dialogueState.addDialogueMessage(userId, chatId, 'user', text, {
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

    const topic = inferred?.topic || input.topic || guards.extractTopic(input.userText, '');
    this.contextWindow.recordBotMessage(userId, chatId, botText, {
      topic,
      intent: input.intent || inferred?.type || 'assistant_reply'
    });
    dialogueState.addDialogueMessage(userId, chatId, 'assistant', botText, {
      topic,
      intent: input.intent || inferred?.type || 'assistant_reply',
      pendingActionId: inferred?.id || ''
    });

    return inferred;
  }

  clearUser(userId, chatId) {
    this.pendingActions.clear(userId, chatId, 'manual_clear');
    this.contextWindow.clear(userId, chatId);
    dialogueState.clearDialogueState(userId, chatId);
  }

  async handleConversationMessage(input = {}) {
    const decision = this.prepare({
      userId: input.userId,
      chatId: input.chatId,
      text: input.text,
      command: input.command || ''
    });

    if (decision.action === 'command') return { handled: false, decision };

    if (decision.action === 'direct') {
      const response = decision.responseText || 'Bisa jelaskan sedikit lagi maksudnya?';
      if (typeof input.sendTelegramMessage === 'function') {
        await input.sendTelegramMessage(input.bot, input.chatId, response, {
          reply_to_message_id: input.msg?.message_id
        });
      }
      this.recordBotReply({
        userId: input.userId,
        chatId: input.chatId,
        userText: input.text,
        botText: response,
        intent: decision.reason || 'conversation_direct'
      });
      return { handled: true, decision, responseText: response };
    }

    if (typeof input.aiPipeline !== 'function') {
      return { handled: false, decision };
    }

    const response = await input.aiPipeline({
      text: input.text,
      userId: input.userId,
      chatId: input.chatId,
      msg: input.msg,
      conversationState: decision
    });

    if (!response) return { handled: false, decision };
    this.recordBotReply({
      userId: input.userId,
      chatId: input.chatId,
      userText: input.text,
      botText: response,
      intent: decision.reason || decision.action || 'conversation_ai'
    });
    return { handled: true, decision, responseText: response };
  }
}

function createConversationManager(options = {}) {
  return new ConversationManager(options);
}

const defaultManager = createConversationManager();

module.exports = defaultManager;
module.exports.ConversationManager = ConversationManager;
module.exports.createConversationManager = createConversationManager;
module.exports.handleConversationMessage = defaultManager.handleConversationMessage.bind(defaultManager);

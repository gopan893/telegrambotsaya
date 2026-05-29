'use strict';

const commandRouter = require('./command-router');
const responsePipeline = require('./response-pipeline');
const errorHandler = require('./error-handler');

function getMessageText(msg = {}) {
  return String(msg.text || msg.caption || '').trim();
}

async function handleNonCommandMessage(context = {}, msg = {}, text = '') {
  try {
    if (context.conversationManager && typeof context.conversationManager.handleConversationMessage === 'function') {
      const result = await context.conversationManager.handleConversationMessage({
        bot: context.bot,
        msg,
        text,
        userId: String(msg.from?.id || ''),
        chatId: msg.chat?.id,
        aiPipeline: (input) => responsePipeline.generateAiResponse(context, input),
        adaptiveRouter: context.adaptiveRouter,
        sendTelegramMessage: context.sendTelegramMessage,
        sendTelegramWithKeyboard: context.sendTelegramWithKeyboard
      });

      if (result?.handled) return true;
    }
  } catch (error) {
    errorHandler.logError('message-handler.conversation', error, {
      userId: msg.from?.id,
      chatId: msg.chat?.id
    }, context.logger);
  }

  await responsePipeline.generateAndSendAiResponse(context, msg, text);
  return true;
}

async function handleTextMessage(context = {}, msg = {}, text = '') {
  if (!text) return false;

  if (text.startsWith('/')) {
    return commandRouter.handleCommand(context, msg, text);
  }

  return handleNonCommandMessage(context, msg, text);
}

async function handleMessage(context = {}, msg = {}) {
  const text = getMessageText(msg);

  if (!text) {
    if (context.legacyAdapter && typeof context.legacyAdapter.handleNonTextMessage === 'function') {
      return context.legacyAdapter.handleNonTextMessage(context, msg);
    }

    if (typeof context.sendTelegramMessage === 'function') {
      await context.sendTelegramMessage(context.bot, msg.chat?.id, 'Maaf, saya hanya bisa membaca pesan teks biasa saat ini.', {
        reply_to_message_id: msg.message_id
      });
    }
    return true;
  }

  return handleTextMessage(context, msg, text);
}

module.exports = {
  handleMessage,
  handleNonCommandMessage,
  handleTextMessage
};

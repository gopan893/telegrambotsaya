'use strict';

const commandRouter = require('./command-router');
const responsePipeline = require('./response-pipeline');
const errorHandler = require('./error-handler');
const telegramUx = require('../telegram-ux');

function getMessageText(msg = {}) {
  return String(msg.text || msg.caption || '').trim();
}

async function handleNonCommandMessage(context = {}, msg = {}, text = '') {
  const routerResult = context._telegramRouterResult;
  if (routerResult && routerResult.dangerousAction) {
    const chatId = msg.chat?.id;
    if (chatId && typeof context.sendTelegramMessage === 'function') {
      const rendered = telegramUx.telegramErrorPresenter.presentApprovalRequired(routerResult.response || 'Tindakan ini');
      for (const part of rendered.parts) {
        await context.sendTelegramMessage(context.bot, chatId, part, {
          reply_to_message_id: msg.message_id
        });
      }
    }
    return true;
  }

  try {
    if (context.conversationManager && typeof context.conversationManager.handleConversationMessage === 'function') {
      const routingHint = routerResult && routerResult.explanation ? routerResult.explanation : null;
      const result = await context.conversationManager.handleConversationMessage({
        bot: context.bot,
        msg,
        text,
        userId: String(msg.from?.id || ''),
        chatId: msg.chat?.id,
        aiPipeline: (input) => responsePipeline.generateAiResponse(context, input),
        adaptiveRouter: context.adaptiveRouter,
        sendTelegramMessage: context.sendTelegramMessage,
        sendTelegramWithKeyboard: context.sendTelegramWithKeyboard,
        routingHint,
        telegramIntent: context._telegramIntent || null
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

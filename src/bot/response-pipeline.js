'use strict';

const errorHandler = require('./error-handler');
const { checkUserDailyBudget } = require('../cost/budget-guard');

async function generateAiResponse(context = {}, input = {}) {
  if (typeof context.aiPipeline === 'function') {
    return context.aiPipeline(input);
  }

  if (context.legacyAdapter && typeof context.legacyAdapter.generateAiResponse === 'function') {
    return context.legacyAdapter.generateAiResponse(context, input);
  }

  throw new Error('AI pipeline is not configured');
}

async function checkUserBudget(context = {}, input = {}) {
  const userId = input.userId || 'unknown';
  const estimatedTokens = input.estimatedTokens || 0;
  const budget = checkUserDailyBudget(userId, estimatedTokens);
  return budget;
}

async function sendAiResponse(context = {}, chatId, response, keyboard = null, options = {}) {
  const text = response || errorHandler.buildSafeErrorMessage();

  if (keyboard && typeof context.sendTelegramWithKeyboard === 'function') {
    return context.sendTelegramWithKeyboard(context.bot, chatId, text, keyboard, options);
  }

  if (typeof context.sendTelegramMessage === 'function') {
    return context.sendTelegramMessage(context.bot, chatId, text, options);
  }

  if (context.legacyAdapter && typeof context.legacyAdapter.sendText === 'function') {
    return context.legacyAdapter.sendText(context, chatId, text, options);
  }

  return false;
}

async function generateAndSendAiResponse(context = {}, msg = {}, text = '', options = {}) {
  const chatId = msg.chat?.id || options.chatId;
  const userId = String(msg.from?.id || options.userId || '');

  const budget = checkUserDailyBudget(userId, text.length * 1.5);
  if (!budget.allowed) {
    const resetDate = new Date(budget.resetAt);
    const resetTime = resetDate.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' });
    await sendAiResponse(context, chatId, `Kamu sudah mencapai limit harian. Reset besok pukul ${resetTime} WIB.`, null, {
      reply_to_message_id: msg.message_id
    });
    return { ok: false, error: new Error('Daily budget exceeded') };
  }

  try {
    const response = await generateAiResponse(context, {
      msg,
      text,
      userId: String(msg.from?.id || options.userId || ''),
      chatId,
      conversationState: options.conversationState || null,
      adaptiveDecision: options.adaptiveDecision || null
    });

    await sendAiResponse(context, chatId, response, options.keyboard || null, {
      reply_to_message_id: msg.message_id
    });

    return {
      ok: true,
      response
    };
  } catch (error) {
    errorHandler.logError('response-pipeline', error, { chatId }, context.logger);
    await errorHandler.notifyAdminIfNeeded(context, error, { scope: 'response-pipeline', chatId });
    await sendAiResponse(context, chatId, errorHandler.buildSafeErrorMessage(), null, {
      reply_to_message_id: msg.message_id
    });

    return {
      ok: false,
      error
    };
  }
}

module.exports = {
  checkUserBudget,
  generateAiResponse,
  generateAndSendAiResponse,
  sendAiResponse
};

'use strict';

const errorHandler = require('./error-handler');
const telegramCenter = require('../telegram-center');
const telegramUx = require('../telegram-ux');

async function answerCallbackQuery(context = {}, callbackQuery = {}, text = '') {
  if (!callbackQuery.id) return false;
  const telegramPost = context.telegramPost || context.legacyAdapter?.telegramPost;
  if (typeof telegramPost !== 'function') return false;

  try {
    await telegramPost('answerCallbackQuery', {
      callback_query_id: callbackQuery.id,
      ...(text ? { text, show_alert: false } : {})
    });
    return true;
  } catch (_) {
    return false;
  }
}

async function handleCallback(context = {}, callbackQuery = {}) {
  if (!callbackQuery || !callbackQuery.id) return false;
  await answerCallbackQuery(context, callbackQuery);

  try {
    const callbackData = callbackQuery.data;
    if (callbackData) {
      const parsed = telegramCenter.telegramCallbackRouter.parseTelegramCallback(callbackData);
      if (parsed) {
        const chatId = callbackQuery.message?.chat?.id;
        const userId = callbackQuery.from?.id;
        const isOwner = Boolean(context.config && String(context.config.OWNER_CHAT_ID) === String(userId));
        const cbCtx = { userId, isOwner, isGroup: callbackQuery.message?.chat?.type === 'group' || callbackQuery.message?.chat?.type === 'supergroup', data: context.data };
        const permission = await telegramCenter.telegramCallbackRouter.validateCallbackPermission(cbCtx, parsed);
        if (permission.allowed) {
          const result = await telegramCenter.telegramCallbackRouter.routeTelegramCallback(cbCtx, parsed);
          if (result.handled && result.passThrough) {
            if (result.action && typeof context.handleCallbackQuery === 'function') {
              return context.handleCallbackQuery(context, callbackQuery);
            }
          }
          if (result.handled && result.text && chatId && typeof context.sendTelegramMessage === 'function') {
            const rendered = telegramUx.telegramMessageRenderer.renderTelegramReply(result.text, { keyboard: result.keyboard || null });
            for (const part of rendered.parts) {
              await context.sendTelegramMessage(context.bot, chatId, part, { reply_to_message_id: callbackQuery.message?.message_id });
            }
            return true;
          }
        }
      }
    }

    if (context.legacyAdapter && typeof context.legacyAdapter.handleCallback === 'function') {
      return context.legacyAdapter.handleCallback(context, callbackQuery);
    }

    if (typeof context.handleCallbackQuery === 'function') {
      return context.handleCallbackQuery(context, callbackQuery);
    }

    return false;
  } catch (error) {
    errorHandler.logError('callback-handler', error, {
      userId: callbackQuery.from?.id,
      data: callbackQuery.data
    }, context.logger);

    const chatId = callbackQuery.message?.chat?.id;
    if (chatId && typeof context.sendTelegramMessage === 'function') {
      await context.sendTelegramMessage(
        context.bot,
        chatId,
        'Konteks tombol ini sudah kedaluwarsa atau gagal diproses. Coba kirim pertanyaannya lagi ya.'
      );
    }
    return true;
  }
}

module.exports = {
  answerCallbackQuery,
  handleCallback
};

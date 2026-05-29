'use strict';

const errorHandler = require('./error-handler');

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

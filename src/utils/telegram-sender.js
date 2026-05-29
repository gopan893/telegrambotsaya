'use strict';

const { formatTelegramMessage, stripTelegramHtml } = require('./telegram-formatter');
const { splitMessage } = require('./message-splitter');

const DEFAULT_CHUNK_LIMIT = 3600;
const DEFAULT_DELAY_MS = 240;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function button(text, callbackData) {
  return {
    text: String(text || '').slice(0, 32),
    callback_data: String(callbackData || '').slice(0, 64)
  };
}

function inlineKeyboard(rows = []) {
  const inline_keyboard = rows
    .filter(Array.isArray)
    .map(row => row.filter(item => item && item.text && item.callback_data).slice(0, 4))
    .filter(row => row.length > 0);

  return inline_keyboard.length ? { inline_keyboard } : null;
}

function withInlineKeyboard(extra = {}, keyboard = null) {
  const reply_markup = keyboard?.inline_keyboard ? keyboard : inlineKeyboard(keyboard || []);
  if (!reply_markup) return { ...extra };
  return {
    ...extra,
    reply_markup
  };
}

function resolveLogger(bot, options) {
  return options.logger || bot?.logger || console;
}

async function rawSend(bot, payload) {
  if (bot && typeof bot.telegramPost === 'function') {
    return bot.telegramPost('sendMessage', payload);
  }

  if (bot && typeof bot.sendMessage === 'function') {
    const { chat_id: chatId, text, ...extra } = payload;
    return bot.sendMessage(chatId, text, extra);
  }

  if (bot?.telegram && typeof bot.telegram.sendMessage === 'function') {
    const { chat_id: chatId, text, ...extra } = payload;
    return bot.telegram.sendMessage(chatId, text, extra);
  }

  throw new Error('Telegram sender tidak tersedia.');
}

function buildChunkText(chunk, index, total) {
  if (total <= 1) return chunk;
  return `<b>Bagian ${index + 1}/${total}</b>\n\n${chunk}`;
}

async function sendPayloadWithFallback(bot, payload, logger) {
  try {
    await rawSend(bot, payload);
    return true;
  } catch (err) {
    const plainPayload = {
      ...payload,
      text: stripTelegramHtml(payload.text)
    };
    delete plainPayload.parse_mode;

    try {
      await rawSend(bot, plainPayload);
      return true;
    } catch (_) {
      const retryWithoutReply = { ...plainPayload };
      delete retryWithoutReply.reply_to_message_id;

      try {
        await rawSend(bot, retryWithoutReply);
        return true;
      } catch (finalErr) {
        if (logger && typeof logger.warn === 'function') {
          logger.warn('Telegram send failed:', finalErr.response?.data || finalErr.message);
        } else {
          console.warn('Telegram send failed:', finalErr.response?.data || finalErr.message);
        }
        return false;
      }
    }
  }
}

async function sendTelegramMessage(bot, chatId, text, options = {}) {
  const logger = resolveLogger(bot, options);
  const formatted = formatTelegramMessage(text);
  const fallback = formatted || formatTelegramMessage('Maaf, aku gagal menyusun jawaban dengan benar.');
  const chunks = splitMessage(fallback, options.maxLength || DEFAULT_CHUNK_LIMIT);
  const replyMarkup = options.reply_markup || null;
  const delayMs = Number.isFinite(options.delayMs) ? options.delayMs : DEFAULT_DELAY_MS;

  if (!chunks.length) return false;

  let ok = true;

  for (let i = 0; i < chunks.length; i++) {
    const isLast = i === chunks.length - 1;
    const payload = {
      ...options,
      chat_id: chatId,
      text: buildChunkText(chunks[i], i, chunks.length),
      parse_mode: 'HTML',
      disable_web_page_preview: options.disable_web_page_preview !== false
    };

    delete payload.logger;
    delete payload.maxLength;
    delete payload.delayMs;

    if (!isLast || !replyMarkup) {
      delete payload.reply_markup;
    } else {
      payload.reply_markup = replyMarkup;
    }

    const sent = await sendPayloadWithFallback(bot, payload, logger);
    ok = ok && sent;

    if (isLast || delayMs <= 0) continue;
    await sleep(delayMs);
  }

  return ok;
}

async function sendTelegramWithKeyboard(bot, chatId, text, keyboard, options = {}) {
  return sendTelegramMessage(bot, chatId, text, {
    ...options,
    reply_markup: keyboard
  });
}

module.exports = {
  button,
  formatTelegramMessage,
  inlineKeyboard,
  sendTelegramMessage,
  sendTelegramWithKeyboard,
  splitMessage,
  withInlineKeyboard
};

'use strict';

const axios = require('axios');
const botRegistry = require('./bot-registry');
const { sanitizeBotConfig } = require('./bot-config');

function resolveBot(botId, services = {}) {
  const env = services.env || process.env;
  return botRegistry.getBotConfig(botId, env) || botRegistry.getDefaultBot(env);
}

function getTelegramApiUrl(botId, method, services = {}) {
  const config = resolveBot(botId, services);
  if (!config?.token) return '';
  return `https://api.telegram.org/bot${config.token}/${method}`;
}

function getBotSafeIdentity(botId, services = {}) {
  const config = resolveBot(botId, services);
  return config ? sanitizeBotConfig(config) : null;
}

async function telegramPostAsBot(botId, method, payload = {}, services = {}) {
  const config = resolveBot(botId, services);
  if (!config?.token) {
    if (typeof services.telegramPost === 'function') return services.telegramPost(method, payload);
    throw new Error('Telegram bot token is not configured.');
  }
  const url = getTelegramApiUrl(config.id, method, services);
  await axios.post(url, payload, { timeout: 15000 });
  return true;
}

async function sendMessageAsBot(botId, chatId, text, options = {}, services = {}) {
  const config = resolveBot(botId, services);
  const defaultBot = botRegistry.getDefaultBot(services.env || process.env);
  let finalText = String(text || '');

  if (!config?.token && botId && defaultBot?.id !== botId) {
    finalText = `[${botId} Agent]\n${finalText}`;
  }

  if ((!config?.token || config.id === defaultBot?.id) && typeof services.safeSendMessage === 'function') {
    return services.safeSendMessage(chatId, finalText, options);
  }

  return telegramPostAsBot(config?.id || botId, 'sendMessage', {
    chat_id: chatId,
    text: finalText,
    parse_mode: options.parse_mode || 'HTML',
    disable_web_page_preview: options.disable_web_page_preview !== false,
    ...options
  }, services);
}

async function editMessageAsBot(botId, chatId, messageId, text, options = {}, services = {}) {
  return telegramPostAsBot(botId, 'editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text: String(text || ''),
    parse_mode: options.parse_mode || 'HTML',
    disable_web_page_preview: options.disable_web_page_preview !== false,
    ...options
  }, services);
}

async function answerCallbackQueryAsBot(botId, callbackQueryId, options = {}, services = {}) {
  return telegramPostAsBot(botId, 'answerCallbackQuery', {
    callback_query_id: callbackQueryId,
    ...options
  }, services);
}

module.exports = {
  answerCallbackQueryAsBot,
  editMessageAsBot,
  getBotSafeIdentity,
  getTelegramApiUrl,
  sendMessageAsBot,
  telegramPostAsBot
};

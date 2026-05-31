'use strict';

const legacyRuntime = require('./legacy-runtime');

// TODO: migrate command, file, calendar, reminder, plugin, and AI pipeline
// handlers from legacy-runtime into dedicated src/bot modules in small slices.

async function startLegacyBotServer(options = {}) {
  return legacyRuntime.startLegacyBotServer(options);
}

function createLegacyBotApp() {
  return legacyRuntime.createLegacyBotApp();
}

async function handleCommand(context = {}, msg = {}, command = '', args = '') {
  if (context.legacyAdapterRuntime?.handleCommand) {
    return context.legacyAdapterRuntime.handleCommand(context, msg, command, args);
  }
  return false;
}

async function handleCallback(context = {}, callbackQuery = {}) {
  if (context.legacyAdapterRuntime?.handleCallback) {
    return context.legacyAdapterRuntime.handleCallback(context, callbackQuery);
  }
  return false;
}

async function sendText(context = {}, chatId, text, options = {}) {
  if (typeof context.sendTelegramMessage === 'function') {
    return context.sendTelegramMessage(context.bot, chatId, text, options);
  }
  return false;
}

module.exports = {
  createLegacyBotApp,
  handleCallback,
  handleCommand,
  sendText,
  startLegacyBotServer
};

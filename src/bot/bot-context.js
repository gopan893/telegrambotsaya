'use strict';

function noopLogger() {
  return {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {}
  };
}

function createBotContext(dependencies = {}) {
  const logger = dependencies.logger || dependencies.log || noopLogger();

  return {
    bot: dependencies.bot || null,
    app: dependencies.app || null,
    config: dependencies.config || {},
    storageManager: dependencies.storageManager || dependencies.storage || null,
    sendTelegramMessage: dependencies.sendTelegramMessage || null,
    sendTelegramWithKeyboard: dependencies.sendTelegramWithKeyboard || null,
    handleConversationMessage: dependencies.handleConversationMessage || null,
    handleCallbackQuery: dependencies.handleCallbackQuery || null,
    aiPipeline: dependencies.aiPipeline || null,
    adaptiveRouter: dependencies.adaptiveRouter || null,
    conversationManager: dependencies.conversationManager || null,
    interactionManager: dependencies.interactionManager || null,
    legacyAdapter: dependencies.legacyAdapter || null,
    logger
  };
}

function validateBotContext(context = {}) {
  const missing = [];
  if (!context.app) missing.push('app');
  if (!context.sendTelegramMessage && !context.legacyAdapter) missing.push('sendTelegramMessage');

  return {
    ok: missing.length === 0,
    missing
  };
}

module.exports = {
  createBotContext,
  validateBotContext
};

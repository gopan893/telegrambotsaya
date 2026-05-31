'use strict';

const express = require('express');
const { readEnv, validateConfig } = require('../../config/env');
const { createLogger } = require('../../core/logger');
const { createBotContext } = require('./bot-context');
const { registerWebhookRoutes } = require('./webhook');
const legacyAdapter = require('./legacy-adapter');

function createBotApp(dependencies = {}) {
  const config = dependencies.config || readEnv();
  validateConfig(config);

  const app = dependencies.app || express();
  const logger = dependencies.logger || createLogger('telegram-bot-app');

  app.use(express.json({ limit: dependencies.jsonLimit || '1mb' }));

  const context = createBotContext({
    ...dependencies,
    app,
    config,
    logger,
    legacyAdapter: dependencies.legacyAdapter || legacyAdapter
  });

  registerWebhookRoutes(app, context);

  return {
    app,
    context
  };
}

async function startBotServer(options = {}) {
  if (options.runtime === 'modular') {
    const { app, context } = createBotApp(options);
    const port = Number(context.config.PORT || process.env.PORT || 3000);
    const server = app.listen(port, '0.0.0.0', () => {
      context.logger.info(`Bot modular server listening on ${port}`);
    });
    return { app, context, server };
  }

  return legacyAdapter.startLegacyBotServer(options);
}

module.exports = {
  createBotApp,
  startBotServer
};

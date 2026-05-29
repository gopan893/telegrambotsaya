'use strict';

const messageHandler = require('./message-handler');
const callbackHandler = require('./callback-handler');
const errorHandler = require('./error-handler');

async function handleTelegramUpdate(context = {}, update = {}) {
  if (!update || typeof update !== 'object') return false;

  if (update.callback_query) {
    return callbackHandler.handleCallback(context, update.callback_query);
  }

  if (update.message || update.edited_message) {
    return messageHandler.handleMessage(context, update.message || update.edited_message);
  }

  return false;
}

function registerWebhookRoutes(app, context = {}) {
  const webhookPath = context.config?.WEBHOOK_PATH || '/webhook';

  app.get('/', (req, res) => res.send('OK'));
  app.get('/health', (req, res) => res.status(200).json({
    ok: true,
    service: 'telegram-ai-bot',
    runtime: context.legacyAdapter ? 'legacy-adapter' : 'modular'
  }));

  app.post(webhookPath, async (req, res) => {
    try {
      await handleTelegramUpdate(context, req.body);
      return res.sendStatus(200);
    } catch (error) {
      errorHandler.logError('webhook', error, {
        updateId: req.body?.update_id
      }, context.logger);
      return res.sendStatus(200);
    }
  });
}

module.exports = {
  handleTelegramUpdate,
  registerWebhookRoutes
};

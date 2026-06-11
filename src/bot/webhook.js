'use strict';

const messageHandler = require('./message-handler');
const callbackHandler = require('./callback-handler');
const errorHandler = require('./error-handler');
const telegramControl = require('../telegram-control');
const telegramRouter = require('../telegram-router');

async function handleTelegramUpdate(context = {}, update = {}) {
  if (!update || typeof update !== 'object') return false;
  const runtimeResult = await telegramControl.runtimeDispatcher.dispatchTelegramUpdate(
    update,
    update.__botId || 'default',
    {
      ...context,
      naturalRouter: telegramControl.naturalRouter,
      botRegistry: context.botRegistry,
      webhookRoute: context.config?.WEBHOOK_PATH || '/webhook',
      safeSendMessage: context.safeSendMessage || (async (chatId, text, options = {}) => {
        if (typeof context.sendTelegramMessage === 'function') {
          return context.sendTelegramMessage(context.bot, chatId, text, options);
        }
        return { ok: false, reason: 'NO_SEND_SERVICE' };
      })
    }
  );
  if (runtimeResult?.handled && !runtimeResult?.passThrough) return runtimeResult;

  if (update.callback_query) {
    return callbackHandler.handleCallback(context, update.callback_query);
  }

  if (update.message || update.edited_message) {
    const msg = update.message || update.edited_message;
    const text = String(msg.text || msg.caption || '').trim();
    if (text && !text.startsWith('/')) {
      const intent = telegramRouter.telegramIntentClassifier.classifyTelegramIntent(text);
      context._telegramIntent = intent;
      context._telegramRouterResult = await telegramRouter.telegramDomainRouter.routeTelegramMessageByDomain(
        { text, chat: msg.chat, from: msg.from },
        intent,
        context
      );
    }
    return messageHandler.handleMessage(context, msg);
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

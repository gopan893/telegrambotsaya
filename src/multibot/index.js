'use strict';

module.exports = {
  botConfig: require('./bot-config'),
  botIdentityResolver: require('./bot-identity-resolver'),
  botRegistry: require('./bot-registry'),
  telegramClient: require('./telegram-client'),
  utils: require('./multibot-utils'),
  webhookManager: require('./webhook-manager')
};

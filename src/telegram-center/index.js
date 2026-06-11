'use strict';

const telegramMenuRegistry = require('./telegram-menu-registry');
const telegramMenuRenderer = require('./telegram-menu-renderer');
const telegramCallbackRouter = require('./telegram-callback-router');
const telegramActionRouter = require('./telegram-action-router');
const telegramSessionState = require('./telegram-session-state');
const telegramCommandHelp = require('./telegram-command-help');
const telegramPermissionView = require('./telegram-permission-view');
const telegramCenterUtils = require('./telegram-center-utils');

module.exports = {
  telegramMenuRegistry,
  telegramMenuRenderer,
  telegramCallbackRouter,
  telegramActionRouter,
  telegramSessionState,
  telegramCommandHelp,
  telegramPermissionView,
  telegramCenterUtils,
  version: '1.0.0',
  name: 'telegram-center'
};

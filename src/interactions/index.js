'use strict';

const actionHandlers = require('./action-handlers');
const callbackRouter = require('./callback-router');
const confirmationHandler = require('./confirmation-handler');
const interactionManager = require('./interaction-manager');
const interactionState = require('./interaction-state');
const interactiveMenu = require('./interactive-menu');
const keyboardBuilder = require('./keyboard-builder');
const guards = require('./interaction-guards');

function configure(options = {}) {
  interactionState.configure({
    redisClient: options.redisClient || null
  });
}

module.exports = {
  actionHandlers,
  callbackRouter,
  confirmationHandler,
  configure,
  guards,
  interactiveMenu,
  keyboardBuilder,
  manager: interactionManager,
  state: interactionState
};

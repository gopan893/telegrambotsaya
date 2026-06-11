'use strict';

const menuRegistry = require('./telegram-menu-registry');
const menuRenderer = require('./telegram-menu-renderer');
const callbackRouter = require('./telegram-callback-router');
const sessionState = require('./telegram-session-state');

async function routeTelegramAction(action, ctx) {
  if (!action) return { handled: false, reason: 'no_action' };
  const parts = String(action).split(':');
  const domain = parts[0];
  if (domain === 'menu') {
    return callbackRouter.handleMenuCallback(ctx, { domain: 'menu', action: parts[1] || 'main', id: null });
  }
  return { handled: false, reason: 'unhandled_action' };
}

async function routeTelegramCommand(command, args, ctx) {
  const cleanCmd = String(command || '').replace(/^\//, '').toLowerCase();
  const menu = menuRegistry.getMenuByCommand(cleanCmd);
  if (!menu) return { handled: false, reason: 'unknown_command' };
  const actor = { isOwner: ctx.isOwner, isAdmin: ctx.isAdmin, isGroup: ctx.isGroup };
  const rendered = menuRenderer.renderMenuByMenuId(menu.id, actor, ctx.data);
  sessionState.setLastMenu(ctx.userId, menu.id);
  return { handled: true, text: rendered.text, keyboard: rendered.keyboard };
}

module.exports = {
  routeTelegramAction,
  routeTelegramCommand
};

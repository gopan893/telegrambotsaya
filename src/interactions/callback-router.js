'use strict';

const actionHandlers = require('./action-handlers');
const confirmationHandler = require('./confirmation-handler');
const interactiveMenu = require('./interactive-menu');
const interactionState = require('./interaction-state');

function parseCallbackData(data) {
  const raw = String(data || '');
  if (!raw.startsWith('ix:')) return null;
  const parts = raw.split(':');
  return {
    raw,
    namespace: parts[0],
    group: parts[1] || '',
    action: parts[2] || '',
    id: parts.slice(3).join(':') || ''
  };
}

function getCtx(query = {}) {
  return {
    userId: String(query.from?.id || ''),
    chatId: query.message?.chat?.id,
    messageId: query.message?.message_id
  };
}

async function answerCallback(services, query, text = '') {
  if (!query?.id || typeof services.telegramPost !== 'function') return;
  try {
    await services.telegramPost('answerCallbackQuery', {
      callback_query_id: query.id,
      ...(text ? { text, show_alert: false } : {})
    });
  } catch (_) {}
}

async function routeMenu(services, query, action) {
  const ctx = getCtx(query);
  if (action === 'coding') return interactiveMenu.showCodingMenu(services, ctx);
  if (action === 'learning') return interactiveMenu.showLearningMenu(services, ctx);
  if (action === 'memory') return interactiveMenu.showMemoryMenu(services, ctx);
  if (action === 'ops') return interactiveMenu.showOpsMenu(services, ctx);
  if (action === 'chat' || action === 'goals' || action === 'workflows' || action === 'calendar' || action === 'settings') {
    return interactiveMenu.showStaticMenu(services, ctx, action);
  }
  return interactiveMenu.showMainMenu(services, ctx);
}

async function handleCallbackQuery(services, query) {
  const parsed = parseCallbackData(query?.data);
  if (!parsed) return false;

  await answerCallback(services, query);

  if (parsed.group === 'menu') {
    await routeMenu(services, query, parsed.action);
    return true;
  }

  if (parsed.group === 'confirm') {
    if (parsed.action === 'yes') return confirmationHandler.confirmAction(services, query, parsed.id);
    if (parsed.action === 'no') return confirmationHandler.cancelAction(services, query, parsed.id);
  }

  if (parsed.group === 'qa') {
    if (parsed.action === 'sum') return actionHandlers.handleSummarize(services, query);
    if (parsed.action === 'explain') return actionHandlers.handleExplainMore(services, query);
    if (parsed.action === 'roadmap') return actionHandlers.handleMakeRoadmap(services, query);
    if (parsed.action === 'save') return actionHandlers.handleSaveMemory(services, query);
    return actionHandlers.handleProductAction(services, query, parsed.action);
  }

  if (parsed.group === 'code') {
    return actionHandlers.handleCodingAction(services, query, parsed.action);
  }

  if (parsed.group === 'learn') {
    return actionHandlers.handleLearningAction(services, query, parsed.action);
  }

  if (parsed.group === 'dec') {
    return actionHandlers.handleDecisionAction(services, query, parsed.action);
  }

  if (parsed.group === 'ops') {
    return actionHandlers.handleOpsAction(services, query, parsed.action);
  }

  const ctx = getCtx(query);
  await interactionState.clearInteraction(ctx.userId);
  if (typeof services.safeSendMessage === 'function') {
    await services.safeSendMessage(ctx.chatId, 'Aksi tombol tidak dikenal. Kirim pesan baru untuk melanjutkan.');
  }
  return true;
}

module.exports = {
  handleCallbackQuery,
  parseCallbackData
};

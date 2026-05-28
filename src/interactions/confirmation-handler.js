'use strict';

const crypto = require('crypto');
const interactionState = require('./interaction-state');
const keyboardBuilder = require('./keyboard-builder');

function createActionId() {
  return crypto.randomBytes(4).toString('hex');
}

function getCtx(query = {}) {
  return {
    userId: String(query.from?.id || ''),
    chatId: query.message?.chat?.id,
    messageId: query.message?.message_id
  };
}

async function requestConfirmation(services, ctx, action = {}) {
  const actionId = action.id || createActionId();
  await interactionState.setInteraction(ctx.userId, {
    type: 'confirmation',
    actionId,
    actionType: action.type,
    payload: action.payload || {},
    chatId: ctx.chatId,
    userId: ctx.userId,
    messageId: ctx.messageId,
    source: 'confirmation'
  }, action.ttlMs || 5 * 60 * 1000);

  const text = action.text || 'Aksi ini butuh konfirmasi. Lanjutkan?';
  await services.safeSendMessage(ctx.chatId, text, {
    reply_to_message_id: ctx.messageId,
    reply_markup: keyboardBuilder.confirmationKeyboard(actionId)
  });
  return actionId;
}

async function confirmAction(services, query, actionId) {
  const ctx = getCtx(query);
  const state = await interactionState.getInteraction(ctx.userId);
  if (!state || state.type !== 'confirmation' || state.actionId !== actionId) {
    await services.safeSendMessage(ctx.chatId, 'Konfirmasi sudah kedaluwarsa. Ulangi perintahnya jika masih diperlukan.');
    return true;
  }

  if (state.actionType === 'clear_interaction_state') {
    await interactionState.clearInteraction(ctx.userId);
    await services.safeSendMessage(ctx.chatId, 'State interaksi sementara sudah dibersihkan.');
    return true;
  }

  if (state.actionType === 'reset_user_summary' && typeof services.ensureUser === 'function') {
    const user = services.ensureUser(ctx.userId);
    user.summary = '';
    if (typeof services.persist === 'function') await services.persist();
    await interactionState.clearInteraction(ctx.userId);
    await services.safeSendMessage(ctx.chatId, 'Memory ringkas user sudah direset.');
    return true;
  }

  if (state.actionType === 'reset_user_memory' && typeof services.resetUserMemory === 'function') {
    await services.resetUserMemory(ctx.userId);
    await interactionState.clearInteraction(ctx.userId);
    await services.safeSendMessage(ctx.chatId, 'Memory personal sudah direset.');
    return true;
  }

  await interactionState.clearInteraction(ctx.userId);
  await services.safeSendMessage(ctx.chatId, 'Aksi dikonfirmasi. Tidak ada eksekusi tambahan untuk action type ini.');
  return true;
}

async function cancelAction(services, query, actionId) {
  const ctx = getCtx(query);
  const state = await interactionState.getInteraction(ctx.userId);
  if (state?.actionId === actionId) {
    await interactionState.clearInteraction(ctx.userId);
  }
  await services.safeSendMessage(ctx.chatId, 'Dibatalkan. Tidak ada perubahan yang dilakukan.');
  return true;
}

module.exports = {
  cancelAction,
  confirmAction,
  requestConfirmation
};

'use strict';

const guards = require('./interaction-guards');
const keyboardBuilder = require('./keyboard-builder');
const state = require('./interaction-state');

function shouldShowInteractiveOptions(context = {}) {
  return guards.shouldOfferOptions(context);
}

function decideKeyboardForResponse(context = {}) {
  const type = guards.classifyContext(context);
  if (type === 'none') return { type, keyboard: null };
  return {
    type,
    keyboard: keyboardBuilder.nextActionKeyboard({ ...context, type })
  };
}

async function buildInteractiveResponse(context = {}) {
  if (!shouldShowInteractiveOptions(context)) {
    return { reply_markup: null, type: 'none' };
  }

  const decision = decideKeyboardForResponse(context);
  if (!decision.keyboard) {
    return { reply_markup: null, type: decision.type };
  }

  await state.setInteraction(context.userId, {
    type: decision.type,
    chatId: context.chatId,
    userId: context.userId,
    userText: guards.compact(context.userText, 800),
    answerText: guards.compact(context.answerText, 1200),
    mode: context.mode || '',
    intent: context.intent || '',
    source: 'ai_response'
  });

  return {
    reply_markup: decision.keyboard,
    type: decision.type
  };
}

module.exports = {
  buildInteractiveResponse,
  decideKeyboardForResponse,
  shouldShowInteractiveOptions
};

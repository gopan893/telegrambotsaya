'use strict';

function button(text, callbackData) {
  return {
    text: String(text || '').slice(0, 32),
    callback_data: String(callbackData || '').slice(0, 64)
  };
}

function inlineKeyboard(rows = []) {
  const inline_keyboard = rows
    .filter(Array.isArray)
    .map(row => row.filter(item => item && item.text && item.callback_data).slice(0, 4))
    .filter(row => row.length > 0);

  return inline_keyboard.length ? { inline_keyboard } : null;
}

function withInlineKeyboard(extra = {}, keyboard = null) {
  const reply_markup = keyboard?.inline_keyboard ? keyboard : inlineKeyboard(keyboard || []);
  if (!reply_markup) return { ...extra };
  return {
    ...extra,
    reply_markup
  };
}

module.exports = {
  button,
  inlineKeyboard,
  withInlineKeyboard
};

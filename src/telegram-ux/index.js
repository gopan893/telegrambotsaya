'use strict';

const telegramMessageRenderer = require('./telegram-message-renderer');
const telegramMessageSplitter = require('./telegram-message-splitter');
const telegramMarkdownSanitizer = require('./telegram-markdown-sanitizer');
const telegramHtmlSanitizer = require('./telegram-html-sanitizer');
const telegramCodeBlockFormatter = require('./telegram-code-block-formatter');
const telegramReplyTemplate = require('./telegram-reply-template');
const telegramInlineKeyboardBuilder = require('./telegram-inline-keyboard-builder');
const telegramErrorPresenter = require('./telegram-error-presenter');
const telegramProgressPresenter = require('./telegram-progress-presenter');
const telegramUxStore = require('./telegram-ux-store');
const telegramUxUtils = require('./telegram-ux-utils');

module.exports = {
  telegramMessageRenderer,
  telegramMessageSplitter,
  telegramMarkdownSanitizer,
  telegramHtmlSanitizer,
  telegramCodeBlockFormatter,
  telegramReplyTemplate,
  telegramInlineKeyboardBuilder,
  telegramErrorPresenter,
  telegramProgressPresenter,
  telegramUxStore,
  telegramUxUtils,
  version: '1.0.0',
  name: 'telegram-ux'
};

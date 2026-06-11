'use strict';

const markdownSanitizer = require('../telegram-ux/telegram-markdown-sanitizer');

function buildActorFromContext(ctx) {
  if (!ctx) return { isOwner: false, isAdmin: false, isGroup: false };
  return {
    isOwner: Boolean(ctx.isOwner) || Boolean(ctx.ownerId && String(ctx.from?.id) === String(ctx.ownerId)),
    isAdmin: Boolean(ctx.isAdmin),
    isGroup: Boolean(ctx.isGroup) || (ctx.chat && ctx.chat.type === 'group' || ctx.chat?.type === 'supergroup'),
    userId: ctx.from?.id || ctx.userId,
    username: ctx.from?.username
  };
}

function cleanCommand(text) {
  if (!text) return '';
  return String(text).replace(/^\//, '').split(/\s+/)[0].toLowerCase();
}

function safeDataPreview(data, maxLen) {
  if (!data) return '';
  const str = typeof data === 'object' ? JSON.stringify(data) : String(data);
  return markdownSanitizer.redactSecrets(str).slice(0, maxLen || 200);
}

module.exports = {
  buildActorFromContext,
  cleanCommand,
  safeDataPreview
};

'use strict';

const markdownSanitizer = require('../telegram-ux/telegram-markdown-sanitizer');

function filterTelegramPrivateContext(ctx, context, intent, services) {
  if (!context) return {};
  const isGroup = ctx && (ctx.chat && (ctx.chat.type === 'group' || ctx.chat.type === 'supergroup'));
  if (isGroup) {
    const filtered = { ...context };
    if (filtered.user) {
      filtered.user = { id: context.user.id, username: context.user.username };
    }
    if (filtered.domain && filtered.domain.lifeos) {
      delete filtered.domain.lifeos;
    }
    return filtered;
  }
  const isPrivateDomain = intent && (intent.domain === 'privacy' || intent.domain === 'memory' || intent.domain === 'rag');
  if (!isPrivateDomain && context.domain) {
    const filtered = { ...context };
    if (filtered.domain.lifeos) delete filtered.domain.lifeos;
    return filtered;
  }
  return context;
}

function detectGroupChatPrivacyRisk(ctx, intent, services) {
  const isGroup = ctx && (ctx.chat && (ctx.chat.type === 'group' || ctx.chat.type === 'supergroup'));
  if (!isGroup) return { risk: false };
  if (intent && (intent.domain === 'privacy' || intent.domain === 'memory')) {
    return { risk: true, reason: 'private_data_in_group', mitigation: 'Tidak dapat menampilkan data pribadi di grup.' };
  }
  return { risk: false };
}

function redactPrivateTelegramOutput(text, ctx, services) {
  if (!text) return '';
  let safe = markdownSanitizer.redactSecrets(String(text));
  const isGroup = ctx && (ctx.chat && (ctx.chat.type === 'group' || ctx.chat.type === 'supergroup'));
  if (isGroup) {
    safe = safe.replace(/(mood|suasana|energi|perasaan).*$/gim, '[private]');
  }
  return safe;
}

function blockPrivateDataInWrongDomain(context, intent, services) {
  if (!context || !intent) return context;
  const allowedDomains = ['privacy', 'memory', 'rag', 'lifeos'];
  if (allowedDomains.includes(intent.domain)) return context;
  const blocked = { ...context };
  if (blocked.domain && blocked.domain.lifeos) delete blocked.domain.lifeos;
  if (blocked.domain && blocked.domain.privateNotes) delete blocked.domain.privateNotes;
  return blocked;
}

module.exports = {
  blockPrivateDataInWrongDomain,
  detectGroupChatPrivacyRisk,
  filterTelegramPrivateContext,
  redactPrivateTelegramOutput
};

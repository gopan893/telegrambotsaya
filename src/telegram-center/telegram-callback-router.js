'use strict';

const menuRegistry = require('./telegram-menu-registry');
const menuRenderer = require('./telegram-menu-renderer');
const inlineKeyboardBuilder = require('../telegram-ux/telegram-inline-keyboard-builder');
const markdownSanitizer = require('../telegram-ux/telegram-markdown-sanitizer');
const sessionState = require('./telegram-session-state');

function parseTelegramCallback(callbackData) {
  if (!callbackData) return null;
  const parts = String(callbackData).split(':');
  const [domain, action, ...rest] = parts;
  const id = rest.length > 0 ? rest.join(':') : null;
  return {
    raw: callbackData,
    domain: domain || 'unknown',
    action: action || 'unknown',
    id: id
  };
}

async function routeTelegramCallback(ctx, callback) {
  if (!callback || !callback.domain) return { handled: false, reason: 'invalid_callback' };
  if (callback.domain === 'menu') {
    return handleMenuCallback(ctx, callback);
  }
  if (callback.domain === 'coding') {
    return handleCodingCallback(ctx, callback);
  }
  if (callback.domain === 'project') {
    return handleProjectCallback(ctx, callback);
  }
  if (callback.domain === 'approval') {
    return handleApprovalCallback(ctx, callback);
  }
  if (callback.domain === 'workflow') {
    return handleWorkflowCallback(ctx, callback);
  }
  if (callback.domain === 'device') {
    return handleDeviceCallback(ctx, callback);
  }
  if (callback.domain === 'status') {
    return handleStatusCallback(ctx, callback);
  }
  if (callback.domain === 'agent') {
    return handleAgentCallback(ctx, callback);
  }
  if (callback.domain === 'memory') {
    return handleMemoryCallback(ctx, callback);
  }
  if (callback.domain === 'settings') {
    return handleSettingsCallback(ctx, callback);
  }
  if (callback.domain === 'detail') {
    return handleDetailCallback(ctx, callback);
  }
  return { handled: false, reason: 'unknown_domain' };
}

async function handleMenuCallback(ctx, callback) {
  const targetId = callback.action || 'main';
  const actor = { isOwner: ctx.isOwner, isAdmin: ctx.isAdmin, isGroup: ctx.isGroup };
  const rendered = menuRenderer.renderMenuByMenuId(targetId, actor, ctx.data);
  sessionState.setLastMenu(ctx.userId, targetId);
  return { handled: true, text: rendered.text, keyboard: rendered.keyboard };
}

async function handleCodingCallback(ctx, callback) {
  const action = callback.action || 'plan';
  const actionMap = {
    plan: { text: 'Membuat rencana coding...', handler: 'coding:plan' },
    prompt: { text: 'Membuat Codex prompt...', handler: 'coding:prompt' },
    risk: { text: 'Review risiko coding...', handler: 'coding:risk' },
    tests: { text: 'Membuat test plan...', handler: 'coding:tests' }
  };
  const entry = actionMap[action];
  if (entry) {
    return { handled: true, text: entry.text, action: entry.handler, passThrough: true };
  }
  return { handled: true, text: 'Aksi coding tidak dikenal.', keyboard: inlineKeyboardBuilder.buildCodingKeyboard() };
}

async function handleProjectCallback(ctx, callback) {
  const action = callback.action || 'roadmap';
  const actionMap = {
    roadmap: { text: 'Menampilkan roadmap...', handler: 'project:roadmap' },
    blockers: { text: 'Menampilkan blocker...', handler: 'project:blockers' },
    prompt: { text: 'Membuat Codex prompt...', handler: 'project:prompt' },
    testplan: { text: 'Membuat test plan...', handler: 'project:testplan' }
  };
  const entry = actionMap[action];
  if (entry) {
    return { handled: true, text: entry.text, action: entry.handler, passThrough: true };
  }
  return { handled: true, text: 'Aksi project tidak dikenal.', keyboard: inlineKeyboardBuilder.buildProjectKeyboard() };
}

async function handleApprovalCallback(ctx, callback) {
  const action = callback.action || 'view';
  const id = callback.id;
  if (!id) return { handled: true, text: 'Proposal ID tidak ditemukan.', keyboard: inlineKeyboardBuilder.buildSafeBackKeyboard() };
  if (action === 'approve') return { handled: true, text: 'Menyetujui proposal ' + id + '...', action: 'approval:approve:' + id, passThrough: true };
  if (action === 'reject') return { handled: true, text: 'Menolak proposal ' + id + '...', action: 'approval:reject:' + id, passThrough: true };
  if (action === 'view') return { handled: true, text: 'Menampilkan detail proposal ' + id + '...', action: 'approval:view:' + id, passThrough: true };
  if (action === 'risk') return { handled: true, text: 'Menjelaskan risiko proposal ' + id + '...', action: 'approval:risk:' + id, passThrough: true };
  return { handled: true, text: 'Aksi approval tidak dikenal.' };
}

async function handleWorkflowCallback(ctx, callback) {
  const action = callback.action || 'create';
  const actionMap = {
    create: { text: 'Membuat workflow baru...', handler: 'workflow:create' },
    templates: { text: 'Menampilkan template workflow...', handler: 'workflow:templates' },
    dryrun: { text: 'Dry run workflow...', handler: 'workflow:dryrun' },
    approvalmap: { text: 'Menampilkan approval map...', handler: 'workflow:approvalmap' }
  };
  const entry = actionMap[action];
  if (entry) return { handled: true, text: entry.text, action: entry.handler, passThrough: true };
  return { handled: true, text: 'Aksi workflow tidak dikenal.' };
}

async function handleDeviceCallback(ctx, callback) {
  const action = callback.action || 'health';
  if (action === 'health') return { handled: true, text: 'Memeriksa kesehatan perangkat...', action: 'device:health', passThrough: true };
  if (action === 'pair') return { handled: true, text: 'Memasangkan perangkat baru...', action: 'device:pair', passThrough: true };
  if (action === 'proposal') return { handled: true, text: 'Membuat proposal untuk perangkat...', action: 'device:proposal', passThrough: true };
  if (action === 'status') return { handled: true, text: 'Menampilkan status perangkat...', action: 'device:status', passThrough: true };
  return { handled: true, text: 'Aksi device tidak dikenal.' };
}

async function handleStatusCallback(ctx, callback) {
  const sub = callback.action || 'system';
  const viewMap = {
    system: 'status:sistem',
    ai: 'status:ai',
    storage: 'status:storage',
    pending: 'status:pending'
  };
  const handler = viewMap[sub];
  if (handler) return { handled: true, text: 'Memuat detail status...', action: handler, passThrough: true };
  return { handled: true, text: 'Aksi status tidak dikenal.' };
}

async function handleAgentCallback(ctx, callback) {
  const agentName = callback.action || 'planner';
  return { handled: true, text: 'Menampilkan detail agent ' + agentName + '...', action: 'agent:' + agentName, passThrough: true };
}

async function handleMemoryCallback(ctx, callback) {
  const action = callback.action || 'search';
  const actionMap = {
    search: { text: 'Membuka pencarian memori...', handler: 'memory:search' },
    project: { text: 'Menampilkan memori project...', handler: 'memory:project' },
    clear: { text: 'Proposal untuk menghapus memori...', handler: 'memory:clear' },
    privacy: { text: 'Menampilkan informasi privasi...', handler: 'memory:privacy' }
  };
  const entry = actionMap[action];
  if (entry) return { handled: true, text: entry.text, action: entry.handler, passThrough: true };
  return { handled: true, text: 'Aksi memori tidak dikenal.' };
}

async function handleSettingsCallback(ctx, callback) {
  const sub = callback.action || 'lang';
  const viewMap = {
    lang: 'settings:language',
    verbosity: 'settings:verbosity',
    model: 'settings:model',
    notify: 'settings:notifications',
    budget: 'settings:budget'
  };
  const handler = viewMap[sub];
  if (handler) return { handled: true, text: 'Membuka pengaturan...', action: handler, passThrough: true };
  return { handled: true, text: 'Aksi settings tidak dikenal.' };
}

async function handleDetailCallback(ctx, callback) {
  const id = callback.id;
  if (!id) return { handled: true, text: 'Detail tidak tersedia.' };
  return { handled: true, text: 'Menampilkan detail...', action: 'detail:show:' + id, passThrough: true };
}

async function validateCallbackPermission(ctx, callback) {
  if (!callback) return { allowed: false, reason: 'invalid_callback' };
  if (callback.domain === 'approval' && callback.action === 'approve') {
    if (!ctx.isOwner) return { allowed: false, reason: 'owner_only' };
  }
  if (callback.domain === 'approval' && callback.action === 'reject') {
    if (!ctx.isOwner) return { allowed: false, reason: 'owner_only' };
  }
  return { allowed: true };
}

async function handleUnknownCallback(ctx, callback) {
  return { handled: true, text: 'Tombol tidak dikenali atau sudah kedaluwarsa. Gunakan /menu untuk kembali.' };
}

module.exports = {
  handleUnknownCallback,
  parseTelegramCallback,
  routeTelegramCallback,
  validateCallbackPermission
};

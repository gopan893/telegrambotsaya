'use strict';

const { redactSecrets } = require('./telegram-markdown-sanitizer');

function button(text, callbackData) {
  return {
    text: String(text || '').slice(0, 32),
    callback_data: redactSecrets(String(callbackData || '')).slice(0, 64)
  };
}

function inlineKeyboard(rows) {
  if (!rows || !Array.isArray(rows) || rows.length === 0) return null;
  const keyboard = rows
    .filter(Array.isArray)
    .map(row => row.filter(item => item && item.text && item.callback_data).slice(0, 4))
    .filter(row => row.length > 0);
  if (keyboard.length === 0) return null;
  return { inline_keyboard: keyboard, reply_markup: { inline_keyboard: keyboard } };
}

function buildMainMenuKeyboard() {
  return inlineKeyboard([
    [button('Status', 'menu:status'), button('Project', 'menu:project')],
    [button('Coding', 'menu:coding'), button('Agents', 'menu:agents')],
    [button('Memory', 'menu:memory'), button('Workflow', 'menu:workflow')],
    [button('Devices', 'menu:devices'), button('Approval', 'menu:approval')],
    [button('Settings', 'menu:settings'), button('Help', 'menu:help')]
  ]);
}

function buildCodingKeyboard() {
  return inlineKeyboard([
    [button('Make Plan', 'coding:plan'), button('Codex Prompt', 'coding:prompt')],
    [button('Review Risk', 'coding:risk'), button('Create Tests', 'coding:tests')],
    [button('Back', 'menu:main')]
  ]);
}

function buildProjectKeyboard() {
  return inlineKeyboard([
    [button('Roadmap', 'project:roadmap'), button('Blockers', 'project:blockers')],
    [button('Codex Prompt', 'project:prompt'), button('Test Plan', 'project:testplan')],
    [button('Back', 'menu:main')]
  ]);
}

function buildApprovalKeyboard(proposalId) {
  if (!proposalId) return buildSafeBackKeyboard();
  const safeId = String(proposalId).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 20);
  return inlineKeyboard([
    [button('View Details', 'approval:view:' + safeId)],
    [button('Approve', 'approval:approve:' + safeId), button('Reject', 'approval:reject:' + safeId)],
    [button('Explain Risk', 'approval:risk:' + safeId)],
    [button('Back', 'menu:approval')]
  ]);
}

function buildWorkflowKeyboard(workflowId) {
  if (!workflowId) return buildSafeBackKeyboard();
  const safeId = String(workflowId).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 20);
  return inlineKeyboard([
    [button('Create Workflow', 'workflow:create'), button('Templates', 'workflow:templates')],
    [button('Dry Run', 'workflow:dryrun:' + safeId), button('Approval Map', 'workflow:approvalmap')],
    [button('Back', 'menu:workflow')]
  ]);
}

function buildDeviceKeyboard(deviceId) {
  if (!deviceId) {
    return inlineKeyboard([
      [button('Health', 'device:health'), button('Pair Device', 'device:pair')],
      [button('Create Proposal', 'device:proposal')],
      [button('Back', 'menu:devices')]
    ]);
  }
  const safeId = String(deviceId).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 20);
  return inlineKeyboard([
    [button('Health', 'device:health:' + safeId), button('Status', 'device:status:' + safeId)],
    [button('Create Proposal', 'device:proposal:' + safeId)],
    [button('Back', 'menu:devices')]
  ]);
}

function buildMoreDetailsKeyboard(contextId) {
  if (!contextId) return buildSafeBackKeyboard();
  const safeId = String(contextId).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 20);
  return inlineKeyboard([
    [button('More Details', 'detail:show:' + safeId)],
    [button('Back', 'menu:main')]
  ]);
}

function buildSafeBackKeyboard() {
  return inlineKeyboard([
    [button('Back', 'menu:main')]
  ]);
}

function buildStatusKeyboard() {
  return inlineKeyboard([
    [button('System', 'status:system'), button('AI Provider', 'status:ai')],
    [button('Storage', 'status:storage'), button('Pending', 'status:pending')],
    [button('Back', 'menu:main')]
  ]);
}

function buildAgentsKeyboard() {
  return inlineKeyboard([
    [button('Planner', 'agent:planner'), button('Coder', 'agent:coder')],
    [button('Critic', 'agent:critic'), button('Security', 'agent:security')],
    [button('Ops', 'agent:ops'), button('Memory', 'agent:memory')],
    [button('Back', 'menu:main')]
  ]);
}

function buildMemoryKeyboard() {
  return inlineKeyboard([
    [button('Search Memory', 'memory:search'), button('Project Memory', 'memory:project')],
    [button('Clear? Proposal', 'memory:clear'), button('Privacy', 'memory:privacy')],
    [button('Back', 'menu:main')]
  ]);
}

function buildSettingsKeyboard() {
  return inlineKeyboard([
    [button('Language', 'settings:lang'), button('Verbosity', 'settings:verbosity')],
    [button('Model Strategy', 'settings:model'), button('Notifications', 'settings:notify')],
    [button('Budget Mode', 'settings:budget')],
    [button('Back', 'menu:main')]
  ]);
}

module.exports = {
  buildAgentsKeyboard,
  buildApprovalKeyboard,
  buildCodingKeyboard,
  buildDeviceKeyboard,
  buildMainMenuKeyboard,
  buildMemoryKeyboard,
  buildMoreDetailsKeyboard,
  buildProjectKeyboard,
  buildSafeBackKeyboard,
  buildSettingsKeyboard,
  buildStatusKeyboard,
  buildWorkflowKeyboard,
  button,
  inlineKeyboard
};

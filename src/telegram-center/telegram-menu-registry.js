'use strict';

const DEFAULT_MENUS = {
  main: { id: 'main', title: 'Menu Utama', description: 'Menu utama bot', command: 'menu', category: 'core', ownerOnly: false, adminOnly: false, riskLevel: 'read_only', handlerName: 'handleMainMenu', enabled: true },
  status: { id: 'status', title: 'Status', description: 'Status bot dan sistem', command: 'status', category: 'core', ownerOnly: false, adminOnly: false, riskLevel: 'read_only', handlerName: 'handleStatus', enabled: true },
  project: { id: 'project', title: 'Project', description: 'Ringkasan project', command: 'project', category: 'project', ownerOnly: false, adminOnly: false, riskLevel: 'read_only', handlerName: 'handleProject', enabled: true },
  coding: { id: 'coding', title: 'Coding', description: 'Workspace coding', command: 'coding', category: 'coding', ownerOnly: false, adminOnly: false, riskLevel: 'read_only', handlerName: 'handleCoding', enabled: true },
  agents: { id: 'agents', title: 'Agents', description: 'Daftar agent', command: 'agents', category: 'agents', ownerOnly: false, adminOnly: false, riskLevel: 'read_only', handlerName: 'handleAgents', enabled: true },
  memory: { id: 'memory', title: 'Memory', description: 'Status memori dan RAG', command: 'memory', category: 'memory', ownerOnly: false, adminOnly: false, riskLevel: 'read_only', handlerName: 'handleMemory', enabled: true },
  workflow: { id: 'workflow', title: 'Workflow', description: 'Workflow dan template', command: 'workflow', category: 'workflow', ownerOnly: false, adminOnly: false, riskLevel: 'read_only', handlerName: 'handleWorkflow', enabled: true },
  devices: { id: 'devices', title: 'Devices', description: 'Status perangkat', command: 'devices', category: 'devices', ownerOnly: false, adminOnly: false, riskLevel: 'read_only', handlerName: 'handleDevices', enabled: true },
  approval: { id: 'approval', title: 'Approval', description: 'Proposal menunggu', command: 'approval', category: 'approval', ownerOnly: true, adminOnly: true, riskLevel: 'read_only', handlerName: 'handleApproval', enabled: true },
  settings: { id: 'settings', title: 'Settings', description: 'Pengaturan bot', command: 'settings', category: 'settings', ownerOnly: true, adminOnly: false, riskLevel: 'low', handlerName: 'handleSettings', enabled: true },
  help: { id: 'help', title: 'Help', description: 'Bantuan', command: 'help', category: 'core', ownerOnly: false, adminOnly: false, riskLevel: 'read_only', handlerName: 'handleHelp', enabled: true }
};

const callbackToMenuMap = {};
for (const [id, menu] of Object.entries(DEFAULT_MENUS)) {
  callbackToMenuMap['menu:' + id] = menu;
  callbackToMenuMap['menu:' + menu.command] = menu;
}

function buildTelegramMenuRegistry() {
  return { ...DEFAULT_MENUS };
}

function validateTelegramMenuRegistry(registry) {
  const errors = [];
  for (const [id, menu] of Object.entries(registry)) {
    if (!menu.id) errors.push('menu_' + id + '_missing_id');
    if (!menu.title) errors.push('menu_' + id + '_missing_title');
    if (!menu.command) errors.push('menu_' + id + '_missing_command');
    if (!menu.handlerName) errors.push('menu_' + id + '_missing_handlerName');
  }
  return { ok: errors.length === 0, errors };
}

function getMenuByCommand(command) {
  const cleanCmd = String(command || '').replace(/^\//, '').toLowerCase();
  for (const menu of Object.values(DEFAULT_MENUS)) {
    if (menu.command === cleanCmd) return menu;
  }
  return null;
}

function getMenuByCallback(callbackData) {
  if (!callbackData) return null;
  const clean = String(callbackData).toLowerCase();
  return callbackToMenuMap[clean] || null;
}

function listVisibleMenus(actor) {
  const isOwner = actor && actor.isOwner;
  const isAdmin = actor && actor.isAdmin;
  const inGroup = actor && actor.isGroup;
  return Object.values(DEFAULT_MENUS).filter(m => {
    if (!m.enabled) return false;
    if (m.ownerOnly && !isOwner) return false;
    if (m.adminOnly && !isOwner && !isAdmin) return false;
    if (inGroup && m.id === 'settings') return false;
    return true;
  });
}

module.exports = {
  DEFAULT_MENUS,
  buildTelegramMenuRegistry,
  getMenuByCallback,
  getMenuByCommand,
  listVisibleMenus,
  validateTelegramMenuRegistry
};

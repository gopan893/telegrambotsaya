'use strict';

const menuRegistry = require('./telegram-menu-registry');
const inlineKeyboardBuilder = require('../telegram-ux/telegram-inline-keyboard-builder');

function renderMainMenu(actor) {
  const visible = menuRegistry.listVisibleMenus(actor);
  const lines = ['🤖 Telegram AI OS — Menu Utama', ''];
  for (const m of visible) {
    lines.push('/' + m.command + ' — ' + m.description);
  }
  lines.push('', 'Pilih menu di atas atau gunakan tombol di bawah.');
  const text = lines.join('\n');
  const keyboard = inlineKeyboardBuilder.buildMainMenuKeyboard();
  return { text, keyboard };
}

function renderStatusMenu(actor, status) {
  const text = '📊 Status\n\nGunakan tombol di bawah untuk melihat detail.';
  const keyboard = inlineKeyboardBuilder.buildStatusKeyboard();
  return { text, keyboard };
}

function renderProjectMenu(actor, projectData) {
  const lines = ['📋 Project'];
  if (projectData && projectData.summary) lines.push('', projectData.summary);
  if (projectData && projectData.phase) lines.push('Fase:', projectData.phase);
  if (projectData && projectData.blockers) lines.push('Blocker:', projectData.blockers);
  lines.push('', 'Gunakan tombol di bawah untuk aksi.');
  const text = lines.join('\n');
  const keyboard = inlineKeyboardBuilder.buildProjectKeyboard();
  return { text, keyboard };
}

function renderCodingMenu(actor, codingData) {
  const lines = ['💻 Coding Workspace'];
  if (codingData && codingData.summary) lines.push('', codingData.summary);
  if (codingData && codingData.latestTask) lines.push('Tugas terbaru:', codingData.latestTask);
  lines.push('', 'Gunakan tombol di bawah untuk aksi.');
  const text = lines.join('\n');
  const keyboard = inlineKeyboardBuilder.buildCodingKeyboard();
  return { text, keyboard };
}

function renderAgentsMenu(actor, agentsData) {
  const lines = ['🤖 Agents'];
  if (agentsData && agentsData.list && agentsData.list.length > 0) {
    for (const a of agentsData.list) {
      lines.push('• ' + (a.name || a.role || a.id) + ' — ' + (a.status || 'aktif'));
    }
  } else {
    lines.push('Tidak ada data agent.');
  }
  lines.push('', 'Gunakan tombol di bawah untuk detail.');
  const text = lines.join('\n');
  const keyboard = inlineKeyboardBuilder.buildAgentsKeyboard();
  return { text, keyboard };
}

function renderMemoryMenu(actor, memoryData) {
  const lines = ['🧠 Memory & RAG'];
  if (memoryData && memoryData.status) lines.push('Status:', memoryData.status);
  if (memoryData && memoryData.recent) lines.push('Terbaru:', memoryData.recent);
  lines.push('', 'Gunakan tombol di bawah.');
  const text = lines.join('\n');
  const keyboard = inlineKeyboardBuilder.buildMemoryKeyboard();
  return { text, keyboard };
}

function renderWorkflowMenu(actor, workflowData) {
  const lines = ['🔧 Workflow'];
  if (workflowData && workflowData.drafts) lines.push('Draft:', workflowData.drafts);
  if (workflowData && workflowData.templates) lines.push('Templates:', workflowData.templates);
  lines.push('', 'Gunakan tombol di bawah.');
  const text = lines.join('\n');
  const keyboard = inlineKeyboardBuilder.buildWorkflowKeyboard(null);
  return { text, keyboard };
}

function renderDevicesMenu(actor, devicesData) {
  const lines = ['📱 Devices'];
  if (devicesData && devicesData.devices && devicesData.devices.length > 0) {
    for (const d of devicesData.devices) {
      lines.push('• ' + (d.name || d.id) + ' — ' + (d.status || 'unknown'));
    }
  } else {
    lines.push('Tidak ada perangkat terdaftar.');
  }
  lines.push('', 'Gunakan tombol di bawah.');
  const text = lines.join('\n');
  const keyboard = inlineKeyboardBuilder.buildDeviceKeyboard(null);
  return { text, keyboard };
}

function renderApprovalMenu(actor, proposals) {
  const lines = ['📋 Pending Approval'];
  if (proposals && proposals.length > 0) {
    for (const p of proposals) {
      lines.push('• ' + (p.id || '?') + ' — ' + (p.action || p.command || '?') + ' [' + (p.riskLevel || '?') + ']');
    }
  } else {
    lines.push('Tidak ada proposal menunggu.');
  }
  lines.push('', 'Gunakan /approve <id> atau /reject <id>');
  const text = lines.join('\n');
  const keyboard = null;
  return { text, keyboard };
}

function renderSettingsMenu(actor) {
  const lines = ['⚙️ Settings', '', 'Gunakan tombol di bawah untuk mengubah pengaturan.'];
  const text = lines.join('\n');
  const keyboard = inlineKeyboardBuilder.buildSettingsKeyboard();
  return { text, keyboard };
}

function renderHelpMenu(actor) {
  const lines = ['Bantuan Telegram AI OS', '', 'Gunakan perintah:'];
  const visible = menuRegistry.listVisibleMenus(actor);
  for (const m of visible) {
    lines.push('/' + m.command + ' — ' + m.description);
  }
  lines.push('', 'Atau kirim pesan biasa seperti ChatGPT.');
  lines.push('Contoh: "buat prompt codex", "cek project saya"');
  const text = lines.join('\n');
  return { text, keyboard: null };
}

function renderMenuByMenuId(menuId, actor, data) {
  const map = {
    main: renderMainMenu,
    status: renderStatusMenu,
    project: renderProjectMenu,
    coding: renderCodingMenu,
    agents: renderAgentsMenu,
    memory: renderMemoryMenu,
    workflow: renderWorkflowMenu,
    devices: renderDevicesMenu,
    approval: renderApprovalMenu,
    settings: renderSettingsMenu,
    help: renderHelpMenu
  };
  const fn = map[menuId];
  if (!fn) return renderMainMenu(actor);
  return fn(actor, data);
}

module.exports = {
  renderAgentsMenu,
  renderApprovalMenu,
  renderCodingMenu,
  renderDevicesMenu,
  renderHelpMenu,
  renderMainMenu,
  renderMemoryMenu,
  renderMenuByMenuId,
  renderProjectMenu,
  renderSettingsMenu,
  renderStatusMenu,
  renderWorkflowMenu
};

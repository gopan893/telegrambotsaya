'use strict';

function checkTelegramCommandPermission(command, user, chat) {
  if (!command) {
    return { allowed: false, reason: 'Command not found' };
  }
  if (!user) {
    return { allowed: false, reason: 'User not identified' };
  }

  const config = typeof process !== 'undefined' ? process.env || {} : {};
  const ownerChatId = config.OWNER_CHAT_ID || '';
  const adminIdsStr = config.ADMIN_IDS || '';
  const adminIds = adminIdsStr ? adminIdsStr.split(',').map(s => s.trim()).filter(Boolean) : [];

  const userId = String(user.id || user.userId || '');
  const chatId = chat ? String(chat.id || '') : '';
  const isOwner = userId === ownerChatId || chatId === ownerChatId;
  const isAdmin = isOwner || adminIds.includes(userId) || adminIds.includes(chatId);

  if (command.requiresOwner && !isOwner) {
    return { allowed: false, reason: 'This command requires owner privileges' };
  }
  if (command.requiresAdmin && !isAdmin) {
    return { allowed: false, reason: 'This command requires admin privileges' };
  }

  const riskLevel = command.riskLevel || 'read_only';
  if (riskLevel === 'high' || riskLevel === 'danger') {
    if (!isAdmin) {
      return { allowed: false, reason: 'High-risk commands require admin privileges' };
    }
  }

  if (command.module === 'lifeos' && !isOwner) {
    return { allowed: false, reason: 'Life OS data is private to the owner' };
  }

  return { allowed: true, reason: 'Permission granted' };
}

function requireOwner(command, user) {
  if (!command || !user) return false;
  const config = typeof process !== 'undefined' ? process.env || {} : {};
  const ownerChatId = config.OWNER_CHAT_ID || '';
  const userId = String(user.id || user.userId || '');
  return userId === ownerChatId;
}

function requireAdmin(command, user) {
  if (!command || !user) return false;
  const config = typeof process !== 'undefined' ? process.env || {} : {};
  const ownerChatId = config.OWNER_CHAT_ID || '';
  const adminIdsStr = config.ADMIN_IDS || '';
  const adminIds = adminIdsStr ? adminIdsStr.split(',').map(s => s.trim()).filter(Boolean) : [];
  const userId = String(user.id || user.userId || '');
  return userId === ownerChatId || adminIds.includes(userId);
}

function requireWorkspacePermission(command, user, workspace) {
  if (!command || !user) {
    return { allowed: false, reason: 'Command or user not provided' };
  }
  if (command.requiresOwner && !requireOwner(null, user)) {
    return { allowed: false, reason: 'This command requires owner privileges in workspace' };
  }
  return { allowed: true, reason: 'Workspace permission granted' };
}

function buildPermissionDeniedResponse(reason) {
  const base = '⚠️ *Akses ditolak*';
  if (!reason) return `${base}\nAnda tidak memiliki izin untuk perintah ini.`;
  return `${base}\n${reason}`;
}

module.exports = {
  checkTelegramCommandPermission,
  requireOwner,
  requireAdmin,
  requireWorkspacePermission,
  buildPermissionDeniedResponse
};

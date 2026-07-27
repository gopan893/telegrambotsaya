'use strict';

function buildUserPermissionView(user) {
  if (!user) return 'Tidak ada data user.';
  const lines = [
    '👤 Informasi User',
    'User ID: ' + (user.id || '?'),
    'Username: ' + (user.username || '-'),
    'Role: ' + (user.role || 'user'),
    'Owner: ' + (user.isOwner ? 'Ya' : 'Tidak'),
    'Admin: ' + (user.isAdmin ? 'Ya' : 'Tidak')
  ];
  return lines.join('\n');
}

function buildPermissionSummary(actor) {
  const lines = [
    '🔑 Izin Anda',
    'Owner: ' + (actor.isOwner ? 'Ya' : 'Tidak'),
    'Admin: ' + (actor.isAdmin ? 'Ya' : 'Tidak'),
    'Group: ' + (actor.isGroup ? 'Ya' : 'Tidak'),
    '',
    'Menu yang dapat diakses:'
  ];
  const menuRegistry = require('./telegram-menu-registry');
  const visible = menuRegistry.listVisibleMenus(actor);
  for (const m of visible) {
    lines.push('/' + m.command + ' — ' + m.description);
  }
  return lines.join('\n');
}

module.exports = {
  buildPermissionSummary,
  buildUserPermissionView
};

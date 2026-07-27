'use strict';

const SESSION_TTL_MS = 30 * 60 * 1000;

const sessions = new Map();

function getTelegramSession(userId) {
  if (!userId) return null;
  const key = String(userId);
  const now = Date.now();
  let session = sessions.get(key);
  if (!session || (now - session.ts) > SESSION_TTL_MS) {
    session = { userId: key, lastMenu: 'main', ts: now, data: {} };
    sessions.set(key, session);
  }
  session.ts = now;
  return session;
}

function updateTelegramSession(userId, patch) {
  if (!userId || !patch) return null;
  const session = getTelegramSession(userId);
  if (patch.data) {
    Object.assign(session.data, patch.data);
  }
  if (patch.lastMenu) session.lastMenu = patch.lastMenu;
  if (patch.lastIntent) session.lastIntent = patch.lastIntent;
  session.ts = Date.now();
  return session;
}

function clearTelegramSession(userId) {
  if (!userId) return;
  sessions.delete(String(userId));
}

function setLastMenu(userId, menuId) {
  if (!userId) return;
  const session = getTelegramSession(userId);
  session.lastMenu = menuId || 'main';
  session.ts = Date.now();
}

function setLastIntent(userId, intent) {
  if (!userId) return;
  const session = getTelegramSession(userId);
  session.lastIntent = intent;
  session.ts = Date.now();
}

function getLastMenu(userId) {
  const session = getTelegramSession(userId);
  return session ? session.lastMenu : 'main';
}

function getLastIntent(userId) {
  const session = getTelegramSession(userId);
  return session ? session.lastIntent : null;
}

function cleanupExpired() {
  const now = Date.now();
  for (const [key, session] of sessions.entries()) {
    if (now - session.ts > SESSION_TTL_MS) sessions.delete(key);
  }
}

module.exports = {
  cleanupExpired,
  clearTelegramSession,
  getLastIntent,
  getLastMenu,
  getTelegramSession,
  setLastIntent,
  setLastMenu,
  updateTelegramSession
};

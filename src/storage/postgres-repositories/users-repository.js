'use strict';

const { createId, jsonObject, normalizeUserId } = require('./repository-utils');

function mapUser(row = {}) {
  if (!row) return null;
  return {
    id: row.id,
    telegramUserId: row.telegram_user_id,
    chatId: row.chat_id,
    username: row.username,
    firstName: row.first_name,
    lastName: row.last_name,
    role: row.role,
    locale: row.locale,
    timezone: row.timezone,
    settings: row.settings || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastSeenAt: row.last_seen_at
  };
}

function createUsersRepository(pool) {
  async function upsertTelegramUser(user = {}) {
    const telegramUserId = normalizeUserId(user.telegramUserId || user.telegram_user_id || user.id);
    const id = normalizeUserId(user.userId || user.user_id || telegramUserId || createId('user'));
    const chatId = user.chatId || user.chat_id || null;
    const result = await pool.query(
      `INSERT INTO users(
        id, telegram_user_id, chat_id, username, first_name, last_name, role,
        locale, timezone, settings, created_at, updated_at, last_seen_at
      )
      VALUES($1,$2,$3,$4,$5,$6,COALESCE($7,'user'),$8,$9,$10::jsonb,NOW(),NOW(),NOW())
      ON CONFLICT(id) DO UPDATE SET
        telegram_user_id = COALESCE(EXCLUDED.telegram_user_id, users.telegram_user_id),
        chat_id = COALESCE(EXCLUDED.chat_id, users.chat_id),
        username = COALESCE(EXCLUDED.username, users.username),
        first_name = COALESCE(EXCLUDED.first_name, users.first_name),
        last_name = COALESCE(EXCLUDED.last_name, users.last_name),
        role = COALESCE(EXCLUDED.role, users.role),
        locale = COALESCE(EXCLUDED.locale, users.locale),
        timezone = COALESCE(EXCLUDED.timezone, users.timezone),
        settings = COALESCE(EXCLUDED.settings, users.settings),
        updated_at = NOW(),
        last_seen_at = NOW()
      RETURNING *`,
      [
        id,
        telegramUserId || null,
        chatId ? String(chatId) : null,
        user.username || null,
        user.firstName || user.first_name || null,
        user.lastName || user.last_name || null,
        user.role || 'user',
        user.locale || null,
        user.timezone || null,
        JSON.stringify(jsonObject(user.settings))
      ]
    );
    return mapUser(result.rows[0]);
  }

  async function getUserByTelegramId(telegramUserId) {
    const result = await pool.query('SELECT * FROM users WHERE telegram_user_id = $1 LIMIT 1', [String(telegramUserId)]);
    return mapUser(result.rows[0]);
  }

  async function getUserById(userId) {
    const result = await pool.query('SELECT * FROM users WHERE id = $1 LIMIT 1', [String(userId)]);
    return mapUser(result.rows[0]);
  }

  async function updateLastSeen(userId) {
    const result = await pool.query(
      'UPDATE users SET last_seen_at = NOW(), updated_at = NOW() WHERE id = $1 RETURNING *',
      [String(userId)]
    );
    return mapUser(result.rows[0]);
  }

  async function updateUserSettings(userId, settings = {}) {
    const result = await pool.query(
      'UPDATE users SET settings = $2::jsonb, updated_at = NOW() WHERE id = $1 RETURNING *',
      [String(userId), JSON.stringify(jsonObject(settings))]
    );
    return mapUser(result.rows[0]);
  }

  async function ensureUserFromTelegram(msg = {}) {
    const from = msg.from || {};
    return upsertTelegramUser({
      id: from.id,
      telegramUserId: from.id,
      chatId: msg.chat?.id,
      username: from.username,
      firstName: from.first_name,
      lastName: from.last_name,
      locale: from.language_code
    });
  }

  return {
    ensureUserFromTelegram,
    getUserById,
    getUserByTelegramId,
    updateLastSeen,
    updateUserSettings,
    upsertTelegramUser
  };
}

module.exports = {
  createUsersRepository,
  mapUser
};

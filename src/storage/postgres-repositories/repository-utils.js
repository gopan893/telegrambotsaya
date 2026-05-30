'use strict';

const crypto = require('crypto');

function createId(prefix = 'id') {
  if (crypto.randomUUID) return `${prefix}_${crypto.randomUUID()}`;
  return `${prefix}_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
}

function normalizeUserId(userId) {
  return String(userId || '').trim();
}

function clampNumber(value, fallback = 0.5, min = 0, max = 1) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

function normalizeLimit(value, fallback = 10, max = 50) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return fallback;
  return Math.max(1, Math.min(Math.floor(number), max));
}

function textArray(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map(item => String(item || '').trim())
    .filter(Boolean)
    .slice(0, 30);
}

function jsonObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value;
}

async function ensureUserRow(pool, userId) {
  const id = normalizeUserId(userId);
  if (!id) return null;
  await pool.query(
    `INSERT INTO users(id, telegram_user_id, created_at, updated_at, last_seen_at)
     VALUES($1, $1, NOW(), NOW(), NOW())
     ON CONFLICT(id) DO UPDATE SET last_seen_at = NOW(), updated_at = NOW()`,
    [id]
  );
  return id;
}

function buildUpdate(tableName, allowedFields, patch = {}, baseParams = []) {
  const sets = [];
  const params = [...baseParams];

  for (const [inputKey, column] of Object.entries(allowedFields)) {
    if (Object.prototype.hasOwnProperty.call(patch, inputKey)) {
      params.push(patch[inputKey]);
      sets.push(`${column} = $${params.length}`);
    }
  }

  if (!sets.length) return null;
  sets.push('updated_at = NOW()');
  return {
    sql: `UPDATE ${tableName} SET ${sets.join(', ')}`,
    params
  };
}

function mapTimestamp(row, camelKey, snakeKey) {
  return row?.[snakeKey] ? new Date(row[snakeKey]).toISOString() : null;
}

module.exports = {
  buildUpdate,
  clampNumber,
  createId,
  ensureUserRow,
  jsonObject,
  mapTimestamp,
  normalizeLimit,
  normalizeUserId,
  textArray
};

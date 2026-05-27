'use strict';

const { createPostgresPool, checkPool } = require('./database');
const { runMigrations } = require('./migrations');

function createPostgresStore(options = {}) {
  let pool = null;
  let available = false;
  let lastError = null;
  let migrated = false;

  async function init() {
    const created = createPostgresPool(options.databaseUrl, options);
    if (!created.ok) {
      lastError = created.reason;
      available = false;
      return { ok: false, reason: lastError };
    }

    pool = created.pool;
    const health = await checkPool(pool);
    if (!health.ok) {
      lastError = health.reason;
      available = false;
      try { await pool.end(); } catch (_) {}
      pool = null;
      return { ok: false, reason: lastError };
    }

    if (options.runMigrations !== false) {
      await runMigrations(pool);
      migrated = true;
    }

    available = true;
    lastError = null;
    return { ok: true, migrated };
  }

  async function readKey(key, defaultValue) {
    if (!available || !pool) return defaultValue;
    try {
      const result = await pool.query('SELECT value FROM bot_kv WHERE key = $1 LIMIT 1', [key]);
      return result.rows[0]?.value ?? defaultValue;
    } catch (err) {
      lastError = err.message;
      return defaultValue;
    }
  }

  async function writeKey(key, value) {
    if (!available || !pool) return false;
    try {
      await pool.query(
        `INSERT INTO bot_kv(key, value, updated_at)
         VALUES($1, $2::jsonb, NOW())
         ON CONFLICT(key)
         DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [key, JSON.stringify(value)]
      );
      return true;
    } catch (err) {
      lastError = err.message;
      return false;
    }
  }

  async function upsertRecord(tableName, record) {
    if (!available || !pool || !record?.id) return { ok: false, reason: 'postgres_unavailable_or_missing_id' };
    const safeTable = String(tableName || '').replace(/[^a-z_]/g, '');
    if (!safeTable) return { ok: false, reason: 'invalid_table' };
    try {
      await pool.query(
        `INSERT INTO ${safeTable}(id, data, updated_at)
         VALUES($1, $2::jsonb, NOW())
         ON CONFLICT(id)
         DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
        [record.id, JSON.stringify(record)]
      );
      return { ok: true };
    } catch (err) {
      lastError = err.message;
      return { ok: false, reason: err.message };
    }
  }

  async function close() {
    if (pool) {
      try { await pool.end(); } catch (_) {}
    }
    available = false;
    pool = null;
  }

  function status() {
    return {
      type: 'postgres',
      available,
      migrated,
      lastError
    };
  }

  return {
    init,
    readKey,
    writeKey,
    upsertRecord,
    close,
    status
  };
}

module.exports = {
  createPostgresStore
};

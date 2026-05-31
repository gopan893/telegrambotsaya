'use strict';

const { createPostgresPool, checkPool, checkPostgresHealth } = require('./database');
const { safeRunMigrations } = require('./migrations');
const { createPostgresRepositories } = require('./postgres-repositories');

function createPostgresStore(options = {}) {
  let pool = null;
  let available = false;
  let lastError = null;
  let migrated = false;
  let migrationStatus = 'skipped';
  let migrationResult = null;
  let repositories = null;
  let health = null;

  async function init() {
    const created = createPostgresPool(options.databaseUrl, options);
    if (!created.ok) {
      lastError = created.reason;
      available = false;
      health = await checkPostgresHealth({ databaseUrl: options.databaseUrl, env: options.env, force: true });
      return { ok: false, reason: lastError };
    }

    pool = created.pool;
    const connectionHealth = await checkPool(pool);
    if (!connectionHealth.ok) {
      lastError = connectionHealth.reason;
      available = false;
      try { await pool.end(); } catch (_) {}
      pool = null;
      health = await checkPostgresHealth({ databaseUrl: options.databaseUrl, env: options.env, force: true });
      return { ok: false, reason: lastError };
    }

    if (options.runMigrations !== false) {
      try {
        const migration = await safeRunMigrations(pool);
        migrationResult = migration;
        migrationStatus = migration?.status || (migration?.ok ? 'ok' : 'error');
        migrated = Boolean(migration?.ok);
        if (!migration?.ok) {
          throw new Error(migration?.reason || 'migration_failed');
        }
      } catch (err) {
        lastError = err.message;
        available = false;
        try { await pool.end(); } catch (_) {}
        pool = null;
        health = await checkPostgresHealth({ databaseUrl: options.databaseUrl, env: options.env, force: true });
        return { ok: false, reason: lastError };
      }
    }

    available = true;
    repositories = createPostgresRepositories(pool);
    lastError = null;
    health = await checkPostgresHealth({ pool, databaseUrl: options.databaseUrl, env: options.env, force: true });
    return { ok: true, migrated };
  }

  async function getJson(key, defaultValue) {
    if (!available || !pool) return defaultValue;
    try {
      const result = await pool.query('SELECT value FROM app_kv_store WHERE key = $1 LIMIT 1', [key]);
      return result.rows[0]?.value ?? defaultValue;
    } catch (err) {
      lastError = err.message;
      available = false;
      return defaultValue;
    }
  }

  async function setJson(key, value) {
    if (!available || !pool) return false;
    try {
      await pool.query(
        `INSERT INTO app_kv_store(key, value, updated_at)
         VALUES($1, $2::jsonb, NOW())
         ON CONFLICT(key)
         DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [key, JSON.stringify(value)]
      );
      return true;
    } catch (err) {
      lastError = err.message;
      available = false;
      return false;
    }
  }

  async function deleteKey(key) {
    if (!available || !pool) return false;
    try {
      await pool.query('DELETE FROM app_kv_store WHERE key = $1', [key]);
      return true;
    } catch (err) {
      lastError = err.message;
      available = false;
      return false;
    }
  }

  async function listKeys(prefix = '') {
    if (!available || !pool) return [];
    try {
      const result = await pool.query(
        'SELECT key FROM app_kv_store WHERE key LIKE $1 ORDER BY key ASC LIMIT 500',
        [`${String(prefix || '')}%`]
      );
      return result.rows.map(row => row.key);
    } catch (err) {
      lastError = err.message;
      available = false;
      return [];
    }
  }

  async function upsertRecord(tableName, record) {
    if (!available || !pool || !record?.id) return { ok: false, reason: 'postgres_unavailable_or_missing_id' };
    const namespace = String(tableName || '').replace(/[^a-z_]/g, '');
    if (!namespace) return { ok: false, reason: 'invalid_table' };
    try {
      const ok = await setJson(`${namespace}:${record.id}`, record);
      return ok ? { ok: true } : { ok: false, reason: lastError || 'write_failed' };
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
    repositories = null;
  }

  function status() {
    return {
      type: 'postgres',
      table: 'app_kv_store',
      available,
      connected: available,
      migrated,
      migrations: migrationStatus,
      migrationResult,
      lastError,
      health: health || {
        configured: Boolean(options.databaseUrl),
        available,
        tableReady: Boolean(migrated && available),
        status: available ? 'connected' : (options.databaseUrl ? 'unavailable' : 'missing_env'),
        latencyMs: null,
        errorMessageSafe: lastError ? 'connection failed' : null,
        recommendedFix: available ? 'No action needed' : 'Check DATABASE_URL or use JSON fallback'
      }
    };
  }

  function getPool() {
    return pool;
  }

  function getRepositories() {
    return repositories;
  }

  return {
    init,
    getJson,
    setJson,
    deleteKey,
    getPool,
    getRepositories,
    listKeys,
    readKey: getJson,
    writeKey: setJson,
    upsertRecord,
    close,
    status
  };
}

module.exports = {
  createPostgresStore
};

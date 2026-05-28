'use strict';

let singletonPool = null;
let singletonUrl = '';
let lastError = null;

function safeRequirePg() {
  try {
    return require('pg');
  } catch (err) {
    return null;
  }
}

function maskDatabaseUrl(url) {
  if (!url) return '';
  return String(url).replace(/:\/\/([^:]+):([^@]+)@/, '://$1:***@');
}

function createPostgresPool(databaseUrl, options = {}) {
  const pg = safeRequirePg();
  if (!databaseUrl) {
    return {
      ok: false,
      reason: 'DATABASE_URL tidak diset',
      pool: null
    };
  }
  if (!pg?.Pool) {
    return {
      ok: false,
      reason: 'Package pg belum tersedia. Jalankan npm install setelah package.json diperbarui.',
      pool: null
    };
  }

  const pool = new pg.Pool({
    connectionString: databaseUrl,
    max: options.max || 3,
    idleTimeoutMillis: options.idleTimeoutMillis || 30000,
    connectionTimeoutMillis: options.connectionTimeoutMillis || 5000,
    ssl: options.ssl === false ? false : { rejectUnauthorized: false }
  });

  return {
    ok: true,
    pool,
    maskedUrl: maskDatabaseUrl(databaseUrl)
  };
}

function getPool(databaseUrl = process.env.DATABASE_URL, options = {}) {
  if (!databaseUrl) {
    lastError = 'DATABASE_URL tidak diset';
    return null;
  }

  if (singletonPool && singletonUrl === databaseUrl) {
    return singletonPool;
  }

  const created = createPostgresPool(databaseUrl, options);
  if (!created.ok) {
    lastError = created.reason;
    return null;
  }

  singletonPool = created.pool;
  singletonUrl = databaseUrl;
  lastError = null;
  return singletonPool;
}

async function checkPool(pool) {
  if (!pool) return { ok: false, reason: 'pool_missing' };
  try {
    await pool.query('SELECT 1 AS ok');
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}

async function query(sql, params = [], options = {}) {
  const pool = options.pool || getPool(options.databaseUrl || process.env.DATABASE_URL, options);
  if (!pool) {
    return null;
  }

  try {
    return await pool.query(sql, params);
  } catch (err) {
    lastError = err.message;
    return null;
  }
}

async function closeDatabase() {
  if (singletonPool) {
    try {
      await singletonPool.end();
    } catch (_) {}
  }
  singletonPool = null;
  singletonUrl = '';
}

function getLastDatabaseError() {
  return lastError;
}

module.exports = {
  createPostgresPool,
  checkPool,
  getPool,
  query,
  closeDatabase,
  getLastDatabaseError,
  maskDatabaseUrl
};

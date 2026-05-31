'use strict';

let singletonPool = null;
let singletonUrl = '';
let lastError = null;
let lastAvailable = false;

function safeRequirePg() {
  try {
    return require('pg');
  } catch (err) {
    lastError = err.message;
    return null;
  }
}

function getDatabaseUrl(options = {}) {
  return options.databaseUrl || process.env.DATABASE_URL || '';
}

function isPostgresConfigured(env = process.env) {
  return Boolean(env.DATABASE_URL);
}

function shouldUseSsl(databaseUrl = '', env = process.env, options = {}) {
  if (options.ssl === false) return false;
  if (options.ssl === true) return true;
  if (String(env.PGSSL || '').toLowerCase() === 'true') return true;
  return /(render|supabase|neon|railway|amazonaws|azure|heroku)/i.test(String(databaseUrl));
}

function maskDatabaseUrl(url) {
  if (!url) return '';
  return String(url).replace(/:\/\/([^:]+):([^@]+)@/, '://$1:***@');
}

function buildPoolConfig(databaseUrl, options = {}) {
  const env = options.env || process.env;
  const config = {
    connectionString: databaseUrl,
    max: Number(options.max || 5),
    idleTimeoutMillis: Number(options.idleTimeoutMillis || 30000),
    connectionTimeoutMillis: Number(options.connectionTimeoutMillis || 5000)
  };

  if (shouldUseSsl(databaseUrl, env, options)) {
    config.ssl = { rejectUnauthorized: false };
  }

  return config;
}

function createPgPool(options = {}) {
  const pg = safeRequirePg();
  const databaseUrl = getDatabaseUrl(options);

  if (!databaseUrl) {
    lastError = 'DATABASE_URL tidak diset';
    lastAvailable = false;
    return null;
  }

  if (!pg?.Pool) {
    lastError = 'Package pg tidak tersedia';
    lastAvailable = false;
    return null;
  }

  try {
    const pool = new pg.Pool(buildPoolConfig(databaseUrl, options));
    lastError = null;
    return pool;
  } catch (err) {
    lastError = err.message;
    lastAvailable = false;
    return null;
  }
}

function createPostgresPool(databaseUrl, options = {}) {
  const pool = createPgPool({ ...options, databaseUrl });
  if (!pool) {
    return {
      ok: false,
      reason: lastError || 'postgres_pool_failed',
      pool: null
    };
  }

  return {
    ok: true,
    pool,
    maskedUrl: maskDatabaseUrl(databaseUrl)
  };
}

function getPgPool(options = {}) {
  const databaseUrl = getDatabaseUrl(options);
  if (!databaseUrl) {
    lastError = 'DATABASE_URL tidak diset';
    lastAvailable = false;
    return null;
  }

  if (singletonPool && singletonUrl === databaseUrl) {
    return singletonPool;
  }

  singletonPool = createPgPool(options);
  singletonUrl = singletonPool ? databaseUrl : '';
  return singletonPool;
}

function getPool(databaseUrl = process.env.DATABASE_URL, options = {}) {
  return getPgPool({ ...options, databaseUrl });
}

async function testPostgresConnection(options = {}) {
  if (!getDatabaseUrl(options)) {
    return { ok: false, available: false, reason: 'DATABASE_URL tidak diset' };
  }

  const pool = options.pool || getPgPool(options);
  if (!pool) {
    return { ok: false, available: false, reason: lastError || 'pool_missing' };
  }

  try {
    await pool.query('SELECT 1 AS ok');
    lastError = null;
    lastAvailable = true;
    return { ok: true, available: true };
  } catch (err) {
    lastError = err.message;
    lastAvailable = false;
    return { ok: false, available: false, reason: err.message };
  }
}

async function checkPool(pool) {
  return testPostgresConnection({ pool, databaseUrl: process.env.DATABASE_URL || 'pool' });
}

async function query(sql, params = [], options = {}) {
  const pool = options.pool || getPgPool(options);
  if (!pool) return null;

  try {
    return await pool.query(sql, params);
  } catch (err) {
    lastError = err.message;
    lastAvailable = false;
    return null;
  }
}

async function closePgPool() {
  if (singletonPool) {
    try {
      await singletonPool.end();
    } catch (_) {}
  }
  singletonPool = null;
  singletonUrl = '';
  lastAvailable = false;
}

async function closeDatabase() {
  return closePgPool();
}

function isPostgresAvailable() {
  return Boolean(lastAvailable && singletonPool);
}

function getLastDatabaseError() {
  return lastError;
}

module.exports = {
  buildPoolConfig,
  checkPool,
  closeDatabase,
  closePgPool,
  createPgPool,
  createPostgresPool,
  getLastDatabaseError,
  getPgPool,
  getPool,
  isPostgresAvailable,
  isPostgresConfigured,
  maskDatabaseUrl,
  query,
  shouldUseSsl,
  testPostgresConnection
};

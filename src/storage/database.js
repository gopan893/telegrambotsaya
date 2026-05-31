'use strict';

let singletonPool = null;
let singletonUrl = '';
let lastError = null;
let lastAvailable = false;
let lastHealth = null;
let lastHealthAt = 0;

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

function safePostgresError(err, fallback = 'unknown') {
  const message = String(err?.message || err || '').toLowerCase();
  if (!message) return fallback;
  if (/timeout|timed out|etimedout/i.test(message)) return 'timeout';
  if (/does not exist|relation .* does not exist|migration/i.test(message)) return 'migration required';
  if (/password|authentication|sasl|pg_hba|econnrefused|enotfound|connection|connect/i.test(message)) return 'connection failed';
  return fallback;
}

function buildPostgresHealth(patch = {}) {
  return {
    configured: false,
    available: false,
    latencyMs: null,
    errorCode: null,
    errorMessageSafe: 'DATABASE_URL missing',
    tableReady: false,
    status: 'missing_env',
    recommendedFix: 'Set DATABASE_URL or use JSON fallback',
    ...patch
  };
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

async function checkPostgresHealth(options = {}) {
  const env = options.env || process.env;
  const databaseUrl = getDatabaseUrl({ ...options, databaseUrl: options.databaseUrl || env.DATABASE_URL });
  const cacheTtlMs = Number(options.cacheTtlMs || 30000);
  const now = Date.now();

  if (!options.force && !options.pool && lastHealth && now - lastHealthAt < cacheTtlMs) {
    return { ...lastHealth };
  }

  if (!databaseUrl) {
    lastHealth = buildPostgresHealth();
    lastHealthAt = now;
    return { ...lastHealth };
  }

  const pg = safeRequirePg();
  if (!pg?.Pool) {
    lastHealth = buildPostgresHealth({
      configured: true,
      errorMessageSafe: 'pg module missing',
      status: 'pg_missing',
      recommendedFix: 'Install dependency pg'
    });
    lastHealthAt = now;
    return { ...lastHealth };
  }

  const started = Date.now();
  let pool = options.pool || null;
  let temporaryPool = false;

  try {
    if (!pool) {
      pool = new pg.Pool(buildPoolConfig(databaseUrl, {
        ...options,
        connectionTimeoutMillis: options.connectionTimeoutMillis || 5000,
        max: options.max || 1
      }));
      temporaryPool = true;
    }

    await pool.query('SELECT 1 AS ok');
    const tableResult = await pool.query("SELECT to_regclass('public.app_kv_store') AS table_name");
    const tableReady = Boolean(tableResult.rows?.[0]?.table_name);
    const latencyMs = Date.now() - started;
    lastError = tableReady ? null : 'migration required';
    lastAvailable = true;
    lastHealth = buildPostgresHealth({
      configured: true,
      available: true,
      latencyMs,
      errorCode: null,
      errorMessageSafe: tableReady ? null : 'migration required',
      tableReady,
      status: tableReady ? 'connected' : 'migration_required',
      recommendedFix: tableReady ? 'No action needed' : 'Run storage migrations'
    });
  } catch (err) {
    const safe = safePostgresError(err, 'connection failed');
    const status = safe === 'timeout' ? 'timeout' : 'connection_failed';
    lastError = safe;
    lastAvailable = false;
    lastHealth = buildPostgresHealth({
      configured: true,
      available: false,
      latencyMs: Date.now() - started,
      errorCode: err?.code || null,
      errorMessageSafe: safe,
      tableReady: false,
      status,
      recommendedFix: status === 'timeout'
        ? 'Check database network/SSL and retry'
        : 'Check DATABASE_URL, SSL, database availability, and credentials'
    });
  } finally {
    if (temporaryPool && pool) {
      try { await pool.end(); } catch (_) {}
    }
    lastHealthAt = Date.now();
  }

  return { ...lastHealth };
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
  checkPostgresHealth,
  isPostgresAvailable,
  isPostgresConfigured,
  maskDatabaseUrl,
  query,
  shouldUseSsl,
  testPostgresConnection
};

'use strict';

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

async function checkPool(pool) {
  if (!pool) return { ok: false, reason: 'pool_missing' };
  try {
    await pool.query('SELECT 1 AS ok');
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: err.message };
  }
}

module.exports = {
  createPostgresPool,
  checkPool,
  maskDatabaseUrl
};

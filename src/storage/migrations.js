'use strict';

const { MIGRATIONS } = require('./schema');
const database = require('./database');

const MIGRATION_TABLE_SQL = `CREATE TABLE IF NOT EXISTS schema_migrations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`;

async function ensureMigrationTable(client) {
  if (!client || typeof client.query !== 'function') {
    return { ok: false, reason: 'postgres_client_missing' };
  }
  await client.query(MIGRATION_TABLE_SQL);
  return { ok: true };
}

async function getAppliedMigrations(client) {
  await ensureMigrationTable(client);
  const result = await client.query('SELECT id, name, applied_at FROM schema_migrations ORDER BY id ASC');
  return result.rows || [];
}

async function hasMigration(client, id) {
  await ensureMigrationTable(client);
  const result = await client.query('SELECT 1 FROM schema_migrations WHERE id = $1 LIMIT 1', [id]);
  return Boolean(result.rows[0]);
}

async function applyMigration(client, id, name, sql) {
  if (!client || typeof client.query !== 'function') {
    return { ok: false, reason: 'postgres_client_missing' };
  }

  const statements = Array.isArray(sql) ? sql : [sql];
  const alreadyApplied = await hasMigration(client, id);
  if (alreadyApplied) {
    return { ok: true, skipped: true, id, name };
  }

  await client.query('BEGIN');
  try {
    for (const statement of statements) {
      if (String(statement || '').trim()) {
        await client.query(statement);
      }
    }
    await client.query(
      'INSERT INTO schema_migrations(id, name, applied_at) VALUES($1, $2, NOW()) ON CONFLICT(id) DO NOTHING',
      [id, name]
    );
    await client.query('COMMIT');
    return { ok: true, applied: true, id, name, statements: statements.length };
  } catch (err) {
    await client.query('ROLLBACK');
    return { ok: false, id, name, reason: err.message };
  }
}

async function runMigrations(clientOrPool) {
  const client = clientOrPool || database.getPgPool();
  if (!client || typeof client.query !== 'function') {
    return {
      ok: false,
      status: 'skipped',
      reason: 'postgres_unavailable',
      applied: [],
      skipped: []
    };
  }

  await ensureMigrationTable(client);
  const applied = [];
  const skipped = [];

  for (const migration of MIGRATIONS) {
    const result = await applyMigration(client, migration.id, migration.name, migration.sql);
    if (!result.ok) {
      return {
        ok: false,
        status: 'error',
        reason: result.reason,
        failedMigration: migration.id,
        applied,
        skipped
      };
    }
    if (result.skipped) skipped.push(migration.id);
    if (result.applied) applied.push(migration.id);
  }

  return {
    ok: true,
    status: 'ok',
    applied,
    skipped,
    total: MIGRATIONS.length
  };
}

async function safeRunMigrations(clientOrPool) {
  try {
    const client = clientOrPool || database.getPgPool();
    if (!client) {
      return { ok: false, status: 'skipped', reason: 'postgres_unavailable' };
    }
    return await runMigrations(client);
  } catch (err) {
    return { ok: false, status: 'error', reason: err.message };
  }
}

module.exports = {
  MIGRATION_TABLE_SQL,
  MIGRATIONS,
  applyMigration,
  ensureMigrationTable,
  getAppliedMigrations,
  hasMigration,
  runMigrations,
  safeRunMigrations
};

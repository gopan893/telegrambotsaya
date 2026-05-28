'use strict';

const TABLES_SQL = [
  `CREATE TABLE IF NOT EXISTS app_kv_store (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`
];

const INDEX_SQL = [
  'CREATE INDEX IF NOT EXISTS idx_app_kv_store_updated_at ON app_kv_store(updated_at DESC)'
];

const LEGACY_COPY_SQL = `
DO $$
BEGIN
  IF to_regclass('public.bot_kv') IS NOT NULL THEN
    EXECUTE 'INSERT INTO app_kv_store(key, value, updated_at)
             SELECT key, value, updated_at FROM bot_kv
             ON CONFLICT (key) DO NOTHING';
  END IF;
END $$;
`;

async function runMigrations(client) {
  if (!client || typeof client.query !== 'function') {
    return {
      ok: false,
      reason: 'postgres_client_missing',
      tables: 0,
      indexes: 0
    };
  }

  for (const sql of TABLES_SQL) await client.query(sql);
  for (const sql of INDEX_SQL) await client.query(sql);
  await client.query(LEGACY_COPY_SQL);

  return {
    ok: true,
    tables: TABLES_SQL.length,
    indexes: INDEX_SQL.length,
    legacyCopy: true
  };
}

module.exports = {
  TABLES_SQL,
  INDEX_SQL,
  LEGACY_COPY_SQL,
  runMigrations
};

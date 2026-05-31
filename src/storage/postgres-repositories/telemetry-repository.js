'use strict';

const { createId, jsonObject, normalizeLimit } = require('./repository-utils');

const SENSITIVE_KEYS = new Set(['prompt', 'messages', 'apiKey', 'token', 'secret', 'password', 'authorization']);

function compactMetadata(input = {}) {
  const metadata = jsonObject(input);
  const safe = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (SENSITIVE_KEYS.has(key)) continue;
    if (typeof value === 'string') safe[key] = value.slice(0, 300);
    else if (typeof value === 'number' || typeof value === 'boolean') safe[key] = value;
    else if (value && typeof value === 'object') safe[key] = JSON.stringify(value).slice(0, 500);
  }
  return safe;
}

function createTelemetryRepository(pool) {
  async function recordTelemetryEvent(event = {}) {
    const result = await pool.query(
      `INSERT INTO telemetry_events(
        id, user_id, chat_id, event_type, scope, latency_ms, success, error_code,
        model, provider, token_estimate, metadata, created_at
      )
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,NOW())
      RETURNING id`,
      [
        event.id || createId('tel'),
        event.userId || event.user_id || null,
        event.chatId || event.chat_id || null,
        event.eventType || event.event_type || 'event',
        event.scope || null,
        Number.isFinite(Number(event.latencyMs || event.latency_ms)) ? Number(event.latencyMs || event.latency_ms) : null,
        event.success !== false,
        event.errorCode || event.error_code || null,
        event.model || null,
        event.provider || null,
        Number.isFinite(Number(event.tokenEstimate || event.token_estimate)) ? Number(event.tokenEstimate || event.token_estimate) : null,
        JSON.stringify(compactMetadata(event.metadata))
      ]
    );
    return { ok: true, id: result.rows[0]?.id };
  }

  async function getTelemetrySummary(options = {}) {
    const days = Math.max(1, Math.min(Number(options.days || 1), 30));
    const result = await pool.query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE success = false)::int AS errors,
         AVG(latency_ms)::int AS avg_latency_ms,
         provider,
         event_type
       FROM telemetry_events
       WHERE created_at >= NOW() - ($1::int * INTERVAL '1 day')
       GROUP BY provider, event_type
       ORDER BY total DESC
       LIMIT $2`,
      [days, normalizeLimit(options.limit, 20, 100)]
    );
    return result.rows;
  }

  async function pruneTelemetryEvents(options = {}) {
    const days = Math.max(1, Math.min(Number(options.keepDays || 14), 365));
    const result = await pool.query(
      `DELETE FROM telemetry_events
       WHERE created_at < NOW() - ($1::int * INTERVAL '1 day')`,
      [days]
    );
    return { ok: true, count: result.rowCount };
  }

  return {
    getTelemetrySummary,
    pruneTelemetryEvents,
    recordTelemetryEvent
  };
}

module.exports = {
  compactMetadata,
  createTelemetryRepository
};

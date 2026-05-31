'use strict';

const { createId, jsonObject, normalizeLimit } = require('./repository-utils');

function mapIncident(row = {}) {
  if (!row) return null;
  return {
    id: row.id,
    severity: row.severity,
    status: row.status,
    title: row.title,
    description: row.description,
    scope: row.scope,
    errorCode: row.error_code,
    metadata: row.metadata || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    resolvedAt: row.resolved_at
  };
}

function createIncidentsRepository(pool) {
  async function createIncident(incident = {}) {
    const result = await pool.query(
      `INSERT INTO incidents(
        id, severity, status, title, description, scope, error_code, metadata,
        created_at, updated_at
      )
      VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,NOW(),NOW())
      ON CONFLICT(id) DO UPDATE SET
        severity = EXCLUDED.severity,
        status = EXCLUDED.status,
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        scope = EXCLUDED.scope,
        error_code = EXCLUDED.error_code,
        metadata = EXCLUDED.metadata,
        updated_at = NOW()
      RETURNING *`,
      [
        incident.id || createId('inc'),
        incident.severity || 'low',
        incident.status || 'open',
        String(incident.title || 'Incident').slice(0, 240),
        incident.description || null,
        incident.scope || null,
        incident.errorCode || incident.error_code || null,
        JSON.stringify(jsonObject(incident.metadata))
      ]
    );
    return mapIncident(result.rows[0]);
  }

  async function listIncidents(options = {}) {
    const limit = normalizeLimit(options.limit, 20, 100);
    const status = options.status || null;
    const result = await pool.query(
      `SELECT * FROM incidents
       WHERE ($1::text IS NULL OR status = $1)
       ORDER BY
         CASE severity WHEN 'critical' THEN 4 WHEN 'high' THEN 3 WHEN 'medium' THEN 2 ELSE 1 END DESC,
         created_at DESC
       LIMIT $2`,
      [status, limit]
    );
    return result.rows.map(mapIncident);
  }

  async function getIncidentById(incidentId) {
    const result = await pool.query('SELECT * FROM incidents WHERE id = $1 LIMIT 1', [String(incidentId)]);
    return mapIncident(result.rows[0]);
  }

  async function updateIncident(incidentId, patch = {}) {
    const sets = [];
    const params = [String(incidentId)];
    const fieldMap = {
      severity: 'severity',
      status: 'status',
      title: 'title',
      description: 'description',
      scope: 'scope',
      errorCode: 'error_code'
    };
    for (const [key, column] of Object.entries(fieldMap)) {
      if (Object.prototype.hasOwnProperty.call(patch, key)) {
        params.push(patch[key]);
        sets.push(`${column} = $${params.length}`);
      }
    }
    if (patch.metadata) {
      params.push(JSON.stringify(jsonObject(patch.metadata)));
      sets.push(`metadata = $${params.length}::jsonb`);
    }
    if (!sets.length) return getIncidentById(incidentId);

    const result = await pool.query(
      `UPDATE incidents SET ${sets.join(', ')}, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      params
    );
    return mapIncident(result.rows[0]);
  }

  async function resolveIncident(incidentId) {
    const result = await pool.query(
      `UPDATE incidents
       SET status = 'resolved', resolved_at = NOW(), updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [String(incidentId)]
    );
    return mapIncident(result.rows[0]);
  }

  return {
    createIncident,
    getIncidentById,
    listIncidents,
    resolveIncident,
    updateIncident
  };
}

module.exports = {
  createIncidentsRepository,
  mapIncident
};

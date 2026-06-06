'use strict';

const express = require('express');
const observability = require('../observability');
const guards = require('./dashboard-guards');

function getActor(req) {
  return String(req.body?.actorId || req.query?.actorId || req.headers['x-dashboard-actor'] || 'dashboard').slice(0, 80);
}

function getWorkspace(req) {
  return String(req.body?.workspaceId || req.query?.workspaceId || 'default').slice(0, 100);
}

async function ensureResponsePlan(incidentId, services) {
  const incident = await observability.incidentStore.getIncident(incidentId, services);
  if (!incident) return { ok: false, error: 'INCIDENT_NOT_FOUND' };
  if (incident.responsePlanId) {
    const plan = await observability.incidentStore.getResponsePlan(incident.responsePlanId, services);
    if (plan) return { ok: true, incident, plan };
  }
  const result = await observability.incidentResponsePlanner.createIncidentResponsePlan(incidentId, services);
  return { ok: result.ok, incident, plan: result.plan, error: result.error };
}

function registerObservabilityRoutes(router, services = {}) {
  const dr = express.Router();

  dr.get('/', async (req, res) => {
    const health = await observability.productionHealthMonitor.runProductionHealthCheck({ ...services, workspaceId: getWorkspace(req) });
    const incidents = await observability.incidentStore.listIncidents({ status: 'open', workspaceId: getWorkspace(req), limit: 20 }, services);
    const notifications = await observability.incidentStore.listNotifications({}, services);
    return guards.safeDashboardResponse(res, { ok: true, health, incidents, notifications: notifications.slice(0, 10) });
  });

  dr.get('/health', async (req, res) => {
    const health = await observability.productionHealthMonitor.runProductionHealthCheck({ ...services, workspaceId: getWorkspace(req) });
    return guards.safeDashboardResponse(res, { ok: true, health });
  });

  dr.post('/health/check', async (req, res) => {
    const runtime = { ...services, workspaceId: getWorkspace(req), actorId: getActor(req) };
    const health = await observability.productionHealthMonitor.runProductionHealthCheck(runtime);
    const detected = await observability.incidentDetector.detectIncidentFromHealthCheck(health, runtime);
    return guards.safeDashboardResponse(res, { ok: true, health, incident: detected.incident, deduped: detected.deduped || false });
  });

  dr.get('/incidents', async (req, res) => {
    const incidents = await observability.incidentStore.listIncidents({
      status: req.query.status || '',
      severity: req.query.severity || '',
      workspaceId: getWorkspace(req),
      limit: guards.validateLimit(req.query.limit, 50, 200)
    }, services);
    return guards.safeDashboardResponse(res, { ok: true, incidents });
  });

  dr.get('/incidents/:id', async (req, res) => {
    const incident = await observability.incidentStore.getIncident(String(req.params.id || ''), services);
    if (!incident) return guards.safeDashboardResponse(res, { ok: false, error: 'INCIDENT_NOT_FOUND' }, 404);
    const timeline = await observability.incidentTimeline.getIncidentTimeline(incident.id, services);
    const responsePlans = await observability.incidentStore.listResponsePlans({ incidentId: incident.id }, services);
    return guards.safeDashboardResponse(res, { ok: true, incident, timeline, responsePlans });
  });

  dr.post('/incidents/:id/analyze', async (req, res) => {
    const incident = await observability.incidentStore.getIncident(String(req.params.id || ''), services);
    if (!incident) return guards.safeDashboardResponse(res, { ok: false, error: 'INCIDENT_NOT_FOUND' }, 404);
    const analysis = await observability.rootCauseAnalyzer.analyzeRootCause(incident, services);
    const updated = await observability.incidentStore.updateIncident(incident.id, { rootCauseHypothesis: analysis, status: 'investigating' }, services);
    await observability.incidentTimeline.addIncidentEvent(incident.id, {
      source: 'dashboard',
      type: 'root_cause_analysis',
      severity: incident.severity,
      summary: 'Root cause analysis generated.',
      safeDetails: analysis
    }, services);
    return guards.safeDashboardResponse(res, { ok: true, incident: updated, analysis });
  });

  dr.get('/incidents/:id/timeline', async (req, res) => {
    const incident = await observability.incidentStore.getIncident(String(req.params.id || ''), services);
    if (!incident) return guards.safeDashboardResponse(res, { ok: false, error: 'INCIDENT_NOT_FOUND' }, 404);
    const events = await observability.incidentTimeline.getIncidentTimeline(incident.id, services);
    const summary = await observability.incidentTimeline.summarizeIncidentTimeline(incident, services);
    return guards.safeDashboardResponse(res, { ok: true, events, summary });
  });

  dr.post('/incidents/:id/response-plan', async (req, res) => {
    const result = await observability.incidentResponsePlanner.createIncidentResponsePlan(String(req.params.id || ''), {
      ...services,
      actorId: getActor(req),
      workspaceId: getWorkspace(req)
    });
    return guards.safeDashboardResponse(res, result.ok ? result : { ok: false, error: result.error || 'RESPONSE_PLAN_FAILED' }, result.ok ? 200 : 404);
  });

  dr.post('/incidents/:id/propose-repair', async (req, res) => {
    const ensured = await ensureResponsePlan(String(req.params.id || ''), services);
    if (!ensured.ok) return guards.safeDashboardResponse(res, ensured, 404);
    const result = await observability.incidentProposalBuilder.createIncidentRepairProposal(ensured.plan.id, {
      ...services,
      actorId: getActor(req),
      workspaceId: getWorkspace(req)
    }, { actorId: getActor(req), userId: req.body?.userId || getActor(req) });
    return guards.safeDashboardResponse(res, result.ok ? result : { ok: false, error: result.error || 'PROPOSAL_FAILED', evaluation: result.evaluation }, result.ok ? 200 : 400);
  });

  dr.post('/incidents/:id/propose-rollback', async (req, res) => {
    const ensured = await ensureResponsePlan(String(req.params.id || ''), services);
    if (!ensured.ok) return guards.safeDashboardResponse(res, ensured, 404);
    const result = await observability.incidentProposalBuilder.createIncidentRollbackProposal(ensured.plan.id, {
      ...services,
      actorId: getActor(req),
      workspaceId: getWorkspace(req)
    }, { actorId: getActor(req), userId: req.body?.userId || getActor(req) });
    return guards.safeDashboardResponse(res, result.ok ? result : { ok: false, error: result.error || 'ROLLBACK_PROPOSAL_FAILED', evaluation: result.evaluation }, result.ok ? 200 : 400);
  });

  dr.post('/incidents/:id/close', async (req, res) => {
    const incident = await observability.incidentStore.getIncident(String(req.params.id || ''), services);
    if (!incident) return guards.safeDashboardResponse(res, { ok: false, error: 'INCIDENT_NOT_FOUND' }, 404);
    const confirmed = req.body?.confirm === true || String(req.body?.confirmationText || '').toUpperCase() === 'CLOSE';
    if (!confirmed) return guards.safeDashboardResponse(res, { ok: false, error: 'CONFIRM_CLOSE_REQUIRED' }, 400);
    const updated = await observability.incidentStore.updateIncident(incident.id, { status: 'closed', closedAt: new Date().toISOString() }, services);
    await observability.incidentTimeline.addIncidentEvent(incident.id, {
      source: 'dashboard',
      type: 'incident_closed',
      severity: incident.severity,
      summary: 'Incident closed from dashboard.'
    }, services);
    return guards.safeDashboardResponse(res, { ok: true, incident: updated });
  });

  router.use('/observability', dr);
}

module.exports = { registerObservabilityRoutes };

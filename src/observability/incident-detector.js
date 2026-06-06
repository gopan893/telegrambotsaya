'use strict';

const classifier = require('./incident-classifier');
const store = require('./incident-store');
const notifier = require('./incident-notifier');
const sanitizer = require('./observability-sanitizer');
const utils = require('./observability-utils');

async function dedupeIncident(input = {}, services = {}) {
  const fingerprint = input.fingerprint || utils.makeFingerprint([input.source, input.title, input.workspaceId || 'default']);
  const open = await store.listIncidents({ status: 'open', workspaceId: input.workspaceId || 'default', limit: 200 }, services);
  const existing = open.find(item => item.fingerprint === fingerprint || (item.source === input.source && item.title === input.title));
  if (!existing) return { existing: null, fingerprint };
  const updated = await store.updateIncident(existing.id, {
    ...existing,
    summary: input.summary || existing.summary,
    lastSeenAt: utils.nowIso(),
    severity: utils.maxSeverity([existing.severity, input.severity || 'info'])
  }, services);
  return { existing: updated || existing, fingerprint };
}

async function createDetectedIncident(input = {}, services = {}) {
  const dedupe = await dedupeIncident(input, services);
  if (dedupe.existing) return { ok: true, incident: dedupe.existing, deduped: true };
  const classified = classifier.classifyIncident({ ...input, fingerprint: dedupe.fingerprint });
  const incident = await store.upsertIncident(classified, services);
  await store.addIncidentEvent(incident.id, {
    source: input.source || 'observability',
    type: 'detected',
    severity: incident.severity,
    summary: input.summary || input.title,
    safeDetails: input.details || {}
  }, services);
  try {
    services.monitoringSystem?.emit?.('incident', incident.severity, 'Production incident created', `${incident.id}: ${incident.title}`, 'observability');
  } catch (_) {}
  try {
    await notifier.sendIncidentNotification(incident, services);
  } catch (_) {}
  return { ok: true, incident, deduped: false };
}

async function detectIncidentFromHealthCheck(health = {}, services = {}) {
  if (!health || health.status === 'healthy') return { ok: true, incident: null };
  const unhealthy = (health.checks || []).filter(check => ['unhealthy', 'degraded'].includes(check.status));
  return createDetectedIncident({
    workspaceId: services.workspaceId || 'default',
    title: health.status === 'unhealthy' ? 'Production health unhealthy' : 'Production health degraded',
    summary: `Production health is ${health.status}. ${health.blockers?.join('; ') || health.warnings?.join('; ') || ''}`,
    severity: health.status === 'unhealthy' ? 'high' : 'medium',
    source: 'production_health',
    affectedSystems: unhealthy.map(check => check.id),
    details: health
  }, services);
}

function detectIncidentFromDeployFailure(report = {}, services = {}) {
  return createDetectedIncident({
    workspaceId: services.workspaceId || report.workspaceId || 'default',
    title: 'Render deploy failed',
    summary: report.summary || report.error || 'Deploy or post-deploy check failed.',
    severity: 'critical',
    source: 'deploy',
    affectedSystems: ['deploy', 'app'],
    details: report
  }, services);
}

function detectIncidentFromWebhookFailure(report = {}, services = {}) {
  return createDetectedIncident({
    workspaceId: services.workspaceId || report.workspaceId || 'default',
    title: 'Telegram webhook unhealthy',
    summary: report.summary || report.error || 'Webhook health check failed.',
    severity: 'high',
    source: 'telegram_webhook',
    affectedSystems: ['telegram'],
    details: report
  }, services);
}

function detectIncidentFromDashboardRegression(report = {}, services = {}) {
  return createDetectedIncident({
    workspaceId: services.workspaceId || report.workspaceId || 'default',
    title: 'Dashboard regression detected',
    summary: report.summary || report.error || 'Dashboard route or UI regression detected.',
    severity: /overview fallback|ui is not defined|blank/i.test(`${report.summary || ''} ${report.error || ''}`) ? 'high' : 'medium',
    source: 'dashboard_regression',
    affectedSystems: ['dashboard'],
    details: report
  }, services);
}

function detectIncidentFromExecutorGateFailure(report = {}, services = {}) {
  return createDetectedIncident({
    workspaceId: services.workspaceId || report.workspaceId || 'default',
    title: 'Executor approval boundary failure',
    summary: report.summary || report.error || 'Executor approval boundary failed.',
    severity: 'critical',
    source: 'executor_gate',
    affectedSystems: ['executor', 'security'],
    details: report
  }, services);
}

function detectIncidentFromIntegrationGateFailure(report = {}, services = {}) {
  return createDetectedIncident({
    workspaceId: services.workspaceId || report.workspaceId || 'default',
    title: 'Integration Evaluation v2 gate failure',
    summary: report.summary || report.error || 'External integration gate failed or bypass risk detected.',
    severity: /bypass|direct write|secret/i.test(`${report.summary || ''} ${report.error || ''}`) ? 'critical' : 'high',
    source: 'integration_gate',
    affectedSystems: ['integrations', 'security'],
    details: report
  }, services);
}

function sanitizeIncidentInput(input = {}) {
  return sanitizer.sanitize(input);
}

module.exports = {
  createDetectedIncident,
  dedupeIncident,
  detectIncidentFromDashboardRegression,
  detectIncidentFromDeployFailure,
  detectIncidentFromExecutorGateFailure,
  detectIncidentFromHealthCheck,
  detectIncidentFromIntegrationGateFailure,
  detectIncidentFromWebhookFailure,
  sanitizeIncidentInput
};

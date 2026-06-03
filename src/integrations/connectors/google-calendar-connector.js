'use strict';

const sanitizer = require('../connector-result-sanitizer');

const CONNECTOR_ID = 'google_calendar';

function getConfig(env = process.env) {
  return {
    clientIdConfigured: Boolean(env.GOOGLE_CLIENT_ID),
    clientSecretConfigured: Boolean(env.GOOGLE_CLIENT_SECRET),
    redirectUriConfigured: Boolean(env.GOOGLE_REDIRECT_URI),
    configured: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_REDIRECT_URI)
  };
}

function setupPlan(config = getConfig()) {
  return {
    configured: false,
    status: 'oauth_setup_required',
    missing: [
      config.clientIdConfigured ? '' : 'GOOGLE_CLIENT_ID',
      config.clientSecretConfigured ? '' : 'GOOGLE_CLIENT_SECRET',
      config.redirectUriConfigured ? '' : 'GOOGLE_REDIRECT_URI'
    ].filter(Boolean),
    nextSteps: [
      'Configure Google OAuth env in Render.',
      'Authenticate calendar access through the existing /auth flow.',
      'Do not expose Google client secret in chat or dashboard.'
    ]
  };
}

function actionMetadata(action) {
  const readOnly = ['calendar.status', 'calendar.events.list'].includes(action);
  return {
    connectorId: CONNECTOR_ID,
    action,
    readOnly,
    proposalOnly: !readOnly,
    riskLevel: readOnly ? 'low' : 'medium',
    requiresApproval: !readOnly
  };
}

async function runReadOnly(action, payload = {}, context = {}, services = {}) {
  const config = getConfig(services.env || process.env);
  if (action === 'calendar.status') {
    return { ok: true, connectorId: CONNECTOR_ID, action, result: config.configured ? { configured: true, oauth: 'required_per_user' } : setupPlan(config) };
  }
  if (action === 'calendar.events.list') {
    const getCalendarClient = services.getCalendarClient;
    if (!config.configured || typeof getCalendarClient !== 'function') {
      return { ok: true, connectorId: CONNECTOR_ID, action, result: setupPlan(config) };
    }
    const client = await getCalendarClient(context.userId);
    if (!client?.events?.list) {
      return { ok: true, connectorId: CONNECTOR_ID, action, result: { configured: true, authenticated: false, status: 'user_auth_required' } };
    }
    const res = await client.events.list({
      calendarId: 'primary',
      maxResults: Math.min(Number(payload.limit || 10), 20),
      singleEvents: true,
      orderBy: 'startTime',
      timeMin: new Date().toISOString()
    });
    return { ok: true, connectorId: CONNECTOR_ID, action, result: (res.data?.items || []).slice(0, 20).map(event => ({
      id: event.id,
      summary: event.summary,
      start: event.start,
      end: event.end
    })) };
  }
  return { ok: false, connectorId: CONNECTOR_ID, action, error: 'UNSUPPORTED_CALENDAR_READ_ACTION' };
}

function buildWritePlan(action, payload = {}, context = {}) {
  return {
    ok: true,
    connectorId: CONNECTOR_ID,
    action,
    proposalOnly: true,
    riskLevel: 'medium',
    requiresApproval: true,
    dryRun: {
      wouldWrite: true,
      externalWriteBlocked: true,
      summary: sanitizer.compactText(payload.summary || payload.text || context.text || 'Calendar event proposal', 180),
      start: sanitizer.compactText(payload.start || payload.when || '', 120),
      notesPreview: sanitizer.compactText(payload.description || payload.text || '', 420)
    }
  };
}

module.exports = {
  CONNECTOR_ID,
  actionMetadata,
  buildWritePlan,
  getConfig,
  runReadOnly,
  setupPlan
};

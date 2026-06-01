'use strict';

const path = require('path');
const auditLog = require('./audit-log');
const guards = require('./dashboard-guards');
const utils = require('./dashboard-utils');

function dashboardFile(dashboardDir, fileName) {
  return path.join(dashboardDir, fileName);
}

function setNoSensitiveCacheHeaders(res) {
  res.set({
    'Cache-Control': 'public, max-age=300',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer'
  });
}

function registerPwaStaticRoutes(app, dashboardDir) {
  app.get('/dashboard/manifest.webmanifest', (req, res) => {
    setNoSensitiveCacheHeaders(res);
    res.type('application/manifest+json');
    return res.sendFile(dashboardFile(dashboardDir, 'manifest.webmanifest'));
  });

  app.get('/dashboard/service-worker.js', (req, res) => {
    res.set({
      'Cache-Control': 'no-cache',
      'Service-Worker-Allowed': '/dashboard',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer'
    });
    res.type('application/javascript');
    return res.sendFile(dashboardFile(dashboardDir, 'service-worker.js'));
  });
}

function registerPwaApiRoutes(router, services = {}) {
  router.get('/pwa/status', (req, res) => {
    const enabled = String(services.env?.DASHBOARD_ENABLED || process.env.DASHBOARD_ENABLED || '').toLowerCase() === 'true';
    return guards.safeDashboardResponse(res, {
      ok: true,
      dashboardEnabled: enabled,
      pwaSupported: true,
      serviceWorkerScope: '/dashboard',
      manifestUrl: '/dashboard/manifest.webmanifest',
      cachePolicy: {
        staticAssetsOnly: true,
        cachesDashboardApi: false,
        cachesBackupExports: false,
        cachesAuthorizationHeaders: false
      },
      version: utils.getVersion(),
      timestamp: new Date().toISOString()
    });
  });

  router.post('/pwa/cache-clear-note', async (req, res) => {
    try {
      await auditLog.recordAuditLog({
        actorType: 'dashboard',
        actorId: req.body?.actorId || services.actorId || services.env?.OWNER_CHAT_ID || process.env.OWNER_CHAT_ID || 'dashboard-admin',
        action: 'pwa/cache_clear_requested',
        targetType: 'pwa_cache',
        targetId: 'dashboard-static-cache',
        workspaceId: req.body?.workspaceId || req.query?.workspaceId || '',
        permission: 'read',
        decision: 'allowed',
        status: 'ok',
        afterSummary: {
          staticAssetsOnly: true,
          apiCacheCleared: false
        },
        ip: req.ip || req.headers['x-forwarded-for'] || '',
        userAgent: req.headers['user-agent'] || ''
      }, services);
    } catch (_) {}
    return guards.safeDashboardResponse(res, {
      ok: true,
      message: 'Client may clear static dashboard cache. Sensitive API data is never cached by service worker.'
    });
  });
}

module.exports = {
  registerPwaApiRoutes,
  registerPwaStaticRoutes
};

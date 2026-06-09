'use strict';

const mobile = require('../mobile');

function registerMobileRoutes(router, services = {}) {
  const svc = { ...services, env: process.env };

  router.get('/mobile', (req, res) => {
    try {
      res.json({ ok: true, status: 'Mobile/PWA routes active', endpoints: ['profile', 'navigation', 'quick-actions', 'offline', 'notifications'] });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/mobile/profile', async (req, res) => {
    try {
      const userId = req.query?.userId || req.query?.actorId || 'default';
      const profile = mobile.mobileDashboardProfile.getMobileDashboardProfile(userId, svc);
      res.json({ ok: true, profile });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.post('/mobile/profile', async (req, res) => {
    try {
      const result = mobile.mobileDashboardProfile.updateMobileDashboardProfile(req.body, svc);
      res.json(result);
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/mobile/navigation', async (req, res) => {
    try {
      const nav = mobile.mobileNavigationManager.getMobileNavigationState(svc);
      res.json({ ok: true, ...nav });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/mobile/quick-actions', async (req, res) => {
    try {
      const actions = mobile.mobileQuickActions.listMobileQuickActions(req.query?.actorId || 'dashboard-admin', svc);
      res.json({ ok: true, actions });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/mobile/offline', async (req, res) => {
    try {
      const status = mobile.pwaOfflineController.getPwaOfflineStatus(svc);
      const limitations = mobile.pwaOfflineController.explainOfflineLimitations(svc);
      const cachePolicy = mobile.pwaCachePolicy.getPwaCachePolicy(svc);
      res.json({ ok: true, status, limitations, cachePolicy });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/mobile/notifications', async (req, res) => {
    try {
      const notifications = mobile.notificationCenter.listDashboardNotifications(req.query, svc);
      res.json({ ok: true, notifications });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.post('/mobile/notifications/:id/read', async (req, res) => {
    try {
      const result = mobile.notificationCenter.markNotificationRead(req.params.id, svc);
      res.json({ ok: true, result });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.post('/mobile/notifications/:id/dismiss', async (req, res) => {
    try {
      const result = mobile.notificationCenter.dismissNotification(req.params.id, svc);
      res.json({ ok: true, result });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/mobile/report', async (req, res) => {
    try {
      const report = mobile.mobileUxReportGenerator.generateMobileUxReport(svc);
      res.json({ ok: true, report });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });
}

module.exports = { registerMobileRoutes };

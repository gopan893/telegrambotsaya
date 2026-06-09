'use strict';

const pluginSdk = require('../plugins');

function registerPluginRoutes(router, services = {}) {
  router.get('/plugins', async (req, res) => {
    try {
      res.json({ ok: true, status: 'Plugin SDK routes active', endpoints: ['list', 'connectors', 'catalog', 'marketplace', 'health', 'logs', 'updates', 'dependency'] });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/plugins/list', async (req, res) => {
    try {
      const plugins = pluginSdk.pluginStore.listPlugins(req.query);
      res.json({ ok: true, plugins });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/plugins/connectors', async (req, res) => {
    try {
      const connectors = pluginSdk.connectorRegistry.getBuiltInConnectors();
      res.json({ ok: true, connectors, categories: pluginSdk.connectorRegistry.listConnectorCategories() });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/plugins/registry', async (req, res) => {
    try {
      const connectors = pluginSdk.pluginStore.listConnectors(req.query);
      res.json({ ok: true, connectors });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.post('/plugins/install', async (req, res) => {
    try {
      const result = pluginSdk.pluginInstaller.installPlugin(req.body?.manifest || {}, req.body?.source || 'dashboard');
      res.json(result);
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.post('/plugins/uninstall', async (req, res) => {
    try {
      const result = pluginSdk.pluginInstaller.uninstallPlugin(req.body?.pluginId);
      res.json(result);
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.post('/plugins/enable', async (req, res) => {
    try {
      const result = pluginSdk.pluginInstaller.enablePlugin(req.body?.pluginId);
      res.json(result);
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.post('/plugins/disable', async (req, res) => {
    try {
      const result = pluginSdk.pluginInstaller.disablePlugin(req.body?.pluginId);
      res.json(result);
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.post('/plugins/connector/create', async (req, res) => {
    try {
      const instance = pluginSdk.connectorFactory.createConnectorInstance(req.body?.connectorId, req.body?.config || {});
      if (!instance) return res.status(400).json({ ok: false, error: 'Unknown connector' });
      res.json({ ok: true, instance });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.post('/plugins/connector/connect', async (req, res) => {
    try {
      const result = await pluginSdk.connectorFactory.connectConnector(req.body?.connectorId, req.body?.auth || {});
      res.json(result);
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.post('/plugins/connector/disconnect', async (req, res) => {
    try {
      const result = await pluginSdk.connectorFactory.disconnectConnector(req.body?.connectorId);
      res.json(result);
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/plugins/marketplace', async (req, res) => {
    try {
      const plugins = await pluginSdk.pluginMarketplaceClient.searchMarketplace(req.query?.q);
      res.json({ ok: true, plugins, categories: pluginSdk.pluginMarketplaceClient.listMarketplaceCategories() });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/plugins/health', async (req, res) => {
    try {
      const health = await pluginSdk.connectorHealthChecker.checkAllConnectorsHealth();
      const stats = pluginSdk.pluginStore.getStats();
      res.json({ ok: true, health, stats });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/plugins/logs', async (req, res) => {
    try {
      const logs = pluginSdk.connectorLogAdapter.getAllConnectorLogs(Number(req.query?.limit) || 100);
      const stats = pluginSdk.connectorLogAdapter.getLogStats();
      res.json({ ok: true, logs, stats });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/plugins/updates', async (req, res) => {
    try {
      const updates = await pluginSdk.pluginUpdateChecker.checkAllUpdates();
      res.json({ ok: true, updates });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/plugins/dependency', async (req, res) => {
    try {
      const report = pluginSdk.pluginDependencyResolver.checkDependencyGraph();
      res.json({ ok: true, report });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.get('/plugins/config', async (req, res) => {
    try {
      const config = pluginSdk.pluginConfigManager.getPluginConfig(req.query?.pluginId);
      if (!config) return res.status(404).json({ ok: false, error: 'Plugin not found' });
      res.json({ ok: true, config });
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });

  router.post('/plugins/config', async (req, res) => {
    try {
      const result = pluginSdk.pluginConfigManager.setPluginConfig(req.body?.pluginId, req.body?.config || {});
      res.json(result);
    } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
  });
}

module.exports = { registerPluginRoutes };

'use strict';

function checkV1CommandCompatibility(services) {
  const aliases = (services && services.v1Aliases) || [];
  const broken = aliases.filter(a => a.broken);
  const preserved = aliases.filter(a => !a.broken);

  return {
    status: broken.length === 0 ? 'compatible' : 'partial',
    total: aliases.length,
    preservedCount: preserved.length,
    brokenCount: broken.length,
    brokenAliases: broken.map(a => a.name),
    details: broken.length === 0
      ? 'All v1 command aliases preserved'
      : `Broken aliases: ${broken.map(a => a.name).join(', ')}`,
  };
}

function checkV1DashboardCompatibility(services) {
  const tabs = (services && services.v1Tabs) || [];
  const broken = tabs.filter(t => t.broken);
  const open = tabs.filter(t => !t.broken);

  return {
    status: broken.length === 0 ? 'compatible' : 'partial',
    total: tabs.length,
    openCount: open.length,
    brokenCount: broken.length,
    brokenTabs: broken.map(t => t.name),
    details: broken.length === 0
      ? 'All v1 dashboard tabs still open'
      : `Broken tabs: ${broken.map(t => t.name).join(', ')}`,
  };
}

function checkV1ApiCompatibility(services) {
  const endpoints = (services && services.v1Endpoints) || [];
  const broken = endpoints.filter(e => e.broken);
  const working = endpoints.filter(e => !e.broken);

  return {
    status: broken.length === 0 ? 'compatible' : 'partial',
    total: endpoints.length,
    workingCount: working.length,
    brokenCount: broken.length,
    brokenEndpoints: broken.map(e => e.path),
    details: broken.length === 0
      ? 'All v1 API endpoints functional'
      : `Broken endpoints: ${broken.map(e => e.path).join(', ')}`,
  };
}

function checkV1CapabilityCompatibility(services) {
  const caps = (services && services.v1Capabilities) || [];
  const broken = caps.filter(c => c.broken);
  const working = caps.filter(c => !c.broken);

  return {
    status: broken.length === 0 ? 'compatible' : 'partial',
    total: caps.length,
    workingCount: working.length,
    brokenCount: broken.length,
    brokenCapabilities: broken.map(c => c.name),
    details: broken.length === 0
      ? 'All v1 capabilities preserved'
      : `Broken capabilities: ${broken.map(c => c.name).join(', ')}`,
  };
}

function checkV1StorageCompatibility(services) {
  const stores = (services && services.v1Stores) || [];
  const broken = stores.filter(s => s.broken);
  const intact = stores.filter(s => !s.broken);

  return {
    status: broken.length === 0 ? 'compatible' : 'partial',
    total: stores.length,
    intactCount: intact.length,
    brokenCount: broken.length,
    brokenStores: broken.map(s => s.name),
    details: broken.length === 0
      ? 'All v1 storage intact'
      : `Broken stores: ${broken.map(s => s.name).join(', ')}`,
  };
}

function buildV2CompatibilityReport(services) {
  const commands = checkV1CommandCompatibility(services);
  const dashboard = checkV1DashboardCompatibility(services);
  const api = checkV1ApiCompatibility(services);
  const capabilities = checkV1CapabilityCompatibility(services);
  const storage = checkV1StorageCompatibility(services);

  const allChecks = [commands, dashboard, api, capabilities, storage];
  const compatibleCount = allChecks.filter(c => c.status === 'compatible').length;

  return {
    summary: compatibleCount === allChecks.length ? 'FULLY COMPATIBLE' : 'PARTIAL COMPATIBILITY',
    checks: { commands, dashboard, api, capabilities, storage },
    timestamp: new Date().toISOString(),
  };
}

module.exports = {
  checkV1CommandCompatibility,
  checkV1DashboardCompatibility,
  checkV1ApiCompatibility,
  checkV1CapabilityCompatibility,
  checkV1StorageCompatibility,
  buildV2CompatibilityReport,
};

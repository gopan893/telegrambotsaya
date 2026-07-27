'use strict';

const { buildDashboardTabRegistryV2 } = require('./dashboard-tab-registry-v2');
const { buildDashboardApiRegistryV2 } = require('./dashboard-api-registry-v2');
const { buildTelegramCommandRegistryV2 } = require('./telegram-command-registry-v2');
const { buildCapabilityRegistryV2 } = require('./capability-registry-v2');
const { buildAliasRegistryV2 } = require('./alias-registry-v2');
const { buildCompatibilityBridgeReport } = require('./registry-v2-compatibility-bridge');
const { buildRegistryConflictReport } = require('./registry-v2-conflict-detector');

function generateRegistryV2Report(services) {
  const tabs = buildDashboardTabRegistryV2(services);
  const apis = buildDashboardApiRegistryV2(services);
  const commands = buildTelegramCommandRegistryV2(services);
  const capabilities = buildCapabilityRegistryV2(services);
  const aliases = buildAliasRegistryV2(services);
  const conflicts = buildRegistryConflictReport(services);
  const compat = buildCompatibilityBridgeReport(services);

  const enabledTabs = tabs.filter(t => t.enabled);
  const enabledApis = apis.filter(a => a.enabled);
  const enabledCommands = commands.filter(c => c.enabled);
  const enabledCapabilities = capabilities.filter(c => c.enabled);

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      totalTabs: tabs.length,
      enabledTabs: enabledTabs.length,
      totalApis: apis.length,
      enabledApis: enabledApis.length,
      totalCommands: commands.length,
      enabledCommands: enabledCommands.length,
      totalCapabilities: capabilities.length,
      enabledCapabilities: enabledCapabilities.length,
      totalAliases: aliases.length,
      totalConflicts: conflicts.totalConflicts
    },
    registries: {
      dashboardTabs: enabledTabs.map(t => ({ id: t.id, title: t.title, group: t.group, stable: t.stable })),
      dashboardApis: enabledApis.map(a => ({ id: a.id, method: a.method, path: a.path, tabId: a.tabId })),
      commands: enabledCommands.map(c => ({ id: c.id, command: c.command, module: c.module, riskLevel: c.riskLevel })),
      capabilities: enabledCapabilities.map(c => ({ id: c.id, module: c.module, action: c.action, actionType: c.actionType }))
    },
    conflicts: {
      total: conflicts.totalConflicts,
      bySeverity: conflicts.bySeverity,
      items: conflicts.conflicts.slice(0, 50)
    },
    compatibility: compat
  };
}

module.exports = {
  generateRegistryV2Report
};

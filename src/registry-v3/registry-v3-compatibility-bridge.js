/**
 * Registry v3 Compatibility Bridge
 * Provides compatibility between registry v2 and v3
 */

const contract = require('./registry-v3-contract');
const store = require('./registry-v3-store');

async function mapRegistryV2ToRegistryV3(services) {
  try {
    const { registryV2, logger } = services;

    if (!registryV2) {
      return { success: false, error: 'No registry v2 available' };
    }

    const v3Items = [];

    if (registryV2.getDashboardTabs) {
      const tabs = await registryV2.getDashboardTabs();
      for (const tab of tabs) {
        v3Items.push(contract.createRegistryV3Item({
          ...tab,
          type: 'dashboard_tab',
          canonicalId: `dashboard_tab:${tab.id}`,
          compatibility: { v2Source: 'dashboard-tab-registry-v2' }
        }));
      }
    }

    if (registryV2.getCapabilities) {
      const capabilities = await registryV2.getCapabilities();
      for (const cap of capabilities) {
        v3Items.push(contract.createRegistryV3Item({
          ...cap,
          type: 'capability',
          canonicalId: `capability:${cap.id}`,
          compatibility: { v2Source: 'capability-registry-v2' }
        }));
      }
    }

    if (registryV2.getCommands) {
      const commands = await registryV2.getCommands();
      for (const cmd of commands) {
        v3Items.push(contract.createRegistryV3Item({
          ...cmd,
          type: 'telegram_command',
          canonicalId: `telegram_command:${cmd.id}`,
          compatibility: { v2Source: 'command-registry-v2' }
        }));
      }
    }

    if (registryV2.getAliases) {
      const aliases = await registryV2.getAliases();
      for (const alias of aliases) {
        v3Items.push(contract.createRegistryV3Item({
          ...alias,
          type: 'alias',
          canonicalId: `alias:${alias.id}`,
          compatibility: { v2Source: 'alias-registry-v2' }
        }));
      }
    }

    if (logger) {
      logger.info('[Registry v3] Mapped v2 to v3', { itemCount: v3Items.length });
    }

    return { success: true, items: v3Items };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function mapRegistryV3ToLegacyDashboardCompat(services) {
  try {
    const frozen = store.getFrozen();

    if (!frozen || !frozen.items) {
      return { success: false, error: 'No frozen registry v3' };
    }

    const legacyFormat = {
      tabs: [],
      apis: [],
      commands: [],
      capabilities: [],
      aliases: []
    };

    for (const item of frozen.items) {
      if (item.type === 'dashboard_tab') {
        legacyFormat.tabs.push({
          id: item.id,
          title: item.title,
          dataTab: item.id,
          href: `#${item.id}`,
          enabled: item.enabled,
          group: item.group || 'General'
        });
      } else if (item.type === 'dashboard_api') {
        legacyFormat.apis.push({
          id: item.id,
          path: item.path || `/api/dashboard/${item.id}`,
          method: item.method || 'GET',
          requiresAuth: item.requiresAuth
        });
      } else if (item.type === 'telegram_command') {
        legacyFormat.commands.push({
          id: item.id,
          command: item.command || item.id,
          description: item.description,
          enabled: item.enabled
        });
      } else if (item.type === 'capability') {
        legacyFormat.capabilities.push({
          id: item.id,
          action: item.action || item.id,
          riskLevel: item.riskLevel,
          requiresApproval: item.requiresApproval
        });
      } else if (item.type === 'alias') {
        legacyFormat.aliases.push({
          alias: item.id,
          canonicalId: item.canonicalId,
          enabled: item.enabled
        });
      }
    }

    return { success: true, legacy: legacyFormat };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function resolveRegistryV3Item(idOrAlias, type, services) {
  const frozen = store.getFrozen();

  if (!frozen || !frozen.items) {
    return null;
  }

  let items = frozen.items;
  if (type) {
    items = items.filter(i => i.type === type);
  }

  for (const item of items) {
    if (item.id === idOrAlias) return item;
    if (item.canonicalId === idOrAlias) return item;
    if (item.aliases && item.aliases.includes(idOrAlias)) return item;
  }

  return null;
}

function resolveDashboardTabCompat(tabOrAlias, services) {
  const item = resolveRegistryV3Item(tabOrAlias, 'dashboard_tab', services);

  if (!item) {
    const { registryV2 } = services;
    if (registryV2 && registryV2.getDashboardTab) {
      return registryV2.getDashboardTab(tabOrAlias);
    }
    return null;
  }

  return contract.getDashboardTabContract(item);
}

function resolveApiRouteCompat(routeOrAlias, services) {
  const item = resolveRegistryV3Item(routeOrAlias, 'dashboard_api', services);

  if (!item) {
    const { registryV2 } = services;
    if (registryV2 && registryV2.getApiRoute) {
      return registryV2.getApiRoute(routeOrAlias);
    }
    return null;
  }

  return contract.getDashboardApiContract(item);
}

function resolveCommandCompat(commandOrAlias, services) {
  const item = resolveRegistryV3Item(commandOrAlias, 'telegram_command', services);

  if (!item) {
    const { registryV2 } = services;
    if (registryV2 && registryV2.getCommand) {
      return registryV2.getCommand(commandOrAlias);
    }
    return null;
  }

  return contract.getTelegramCommandContract(item);
}

function resolveCapabilityCompat(capabilityOrAlias, services) {
  const item = resolveRegistryV3Item(capabilityOrAlias, 'capability', services);

  if (!item) {
    const { registryV2 } = services;
    if (registryV2 && registryV2.getCapability) {
      return registryV2.getCapability(capabilityOrAlias);
    }
    return null;
  }

  return contract.getCapabilityContract(item);
}

async function buildRegistryV3CompatibilityReport(services) {
  const { registryV2, logger } = services;
  const frozen = store.getFrozen();

  const report = {
    v2Available: Boolean(registryV2),
    v3Frozen: Boolean(frozen),
    compatibilityStatus: 'unknown',
    v2Items: 0,
    v3Items: frozen?.items?.length || 0,
    mappingStatus: {},
    warnings: [],
    recommendations: []
  };

  if (!registryV2) {
    report.compatibilityStatus = 'no_v2';
    report.warnings.push('Registry v2 not available - compatibility bridge has no source');
    return report;
  }

  if (!frozen) {
    report.compatibilityStatus = 'no_v3';
    report.warnings.push('Registry v3 not frozen - compatibility bridge not active');
    return report;
  }

  const v2Tabs = registryV2.getDashboardTabs ? await registryV2.getDashboardTabs() : [];
  const v2Capabilities = registryV2.getCapabilities ? await registryV2.getCapabilities() : [];
  const v2Commands = registryV2.getCommands ? await registryV2.getCommands() : [];

  report.v2Items = v2Tabs.length + v2Capabilities.length + v2Commands.length;

  const v3Tabs = frozen.items.filter(i => i.type === 'dashboard_tab');
  const v3Capabilities = frozen.items.filter(i => i.type === 'capability');
  const v3Commands = frozen.items.filter(i => i.type === 'telegram_command');

  report.mappingStatus = {
    tabs: { v2: v2Tabs.length, v3: v3Tabs.length },
    capabilities: { v2: v2Capabilities.length, v3: v3Capabilities.length },
    commands: { v2: v2Commands.length, v3: v3Commands.length }
  };

  for (const v2Tab of v2Tabs) {
    const resolved = resolveDashboardTabCompat(v2Tab.id, services);
    if (!resolved) {
      report.warnings.push(`v2 tab ${v2Tab.id} not found in v3`);
    }
  }

  for (const v2Cap of v2Capabilities) {
    const resolved = resolveCapabilityCompat(v2Cap.id, services);
    if (!resolved) {
      report.warnings.push(`v2 capability ${v2Cap.id} not found in v3`);
    }
  }

  const allMapped = report.warnings.length === 0;
  report.compatibilityStatus = allMapped ? 'full_compat' : 'partial_compat';

  if (allMapped) {
    report.recommendations.push('All v2 items mapped to v3 - compatibility bridge active');
  } else {
    report.recommendations.push('Some v2 items not mapped - review warnings before migration');
  }

  return report;
}

module.exports = {
  mapRegistryV2ToRegistryV3,
  mapRegistryV3ToLegacyDashboardCompat,
  resolveRegistryV3Item,
  resolveDashboardTabCompat,
  resolveApiRouteCompat,
  resolveCommandCompat,
  resolveCapabilityCompat,
  buildRegistryV3CompatibilityReport
};

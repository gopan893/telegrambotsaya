'use strict';

const { STABLE_TABS, getDashboardTabByAlias } = require('./dashboard-tab-registry-v2');
const { DEFAULT_APIS } = require('./dashboard-api-registry-v2');
const { BUILTIN_COMMANDS } = require('./telegram-command-registry-v2');
const { BUILTIN_CAPABILITIES } = require('./capability-registry-v2');
const { buildAliasRegistryV2 } = require('./alias-registry-v2');

function getLegacyDashboardRegistryCompat(services) {
  if (services && services.legacyDashboardRegistry) {
    return services.legacyDashboardRegistry;
  }
  return STABLE_TABS.map(tab => ({
    id: tab.id,
    title: tab.title,
    href: tab.href,
    dataTab: tab.dataTab,
    rendererName: tab.rendererName,
    apiEndpoint: tab.apiEndpoint,
    group: tab.group,
    stable: tab.stable,
    enabled: tab.enabled
  }));
}

function getLegacyCommandRegistryCompat(services) {
  if (services && services.legacyCommandRegistry) {
    return services.legacyCommandRegistry;
  }
  return BUILTIN_COMMANDS.map(cmd => ({
    id: cmd.id,
    command: cmd.command,
    aliases: cmd.aliases,
    module: cmd.module,
    description: cmd.description,
    riskLevel: cmd.riskLevel,
    requiresOwner: cmd.requiresOwner,
    requiresAdmin: cmd.requiresAdmin,
    handlerName: cmd.handlerName,
    enabled: cmd.enabled
  }));
}

function getLegacyCapabilityRegistryCompat(services) {
  if (services && services.legacyCapabilityRegistry) {
    return services.legacyCapabilityRegistry;
  }
  return BUILTIN_CAPABILITIES.map(cap => ({
    id: cap.id,
    module: cap.module,
    action: cap.action,
    actionType: cap.actionType,
    riskLevel: cap.riskLevel,
    externalSystem: cap.externalSystem,
    requiresApproval: cap.requiresApproval,
    requiresEvaluation: cap.requiresEvaluation,
    directRunAllowed: cap.directRunAllowed,
    enabled: cap.enabled
  }));
}

function resolveRegistryItemCompat(idOrAlias, type, services) {
  if (type === 'dashboard_tab') {
    const tab = getDashboardTabByAlias(idOrAlias, services);
    if (tab) return tab;
  }
  if (type === 'telegram_command') {
    const commands = services && services.telegramCommands ? services.telegramCommands : BUILTIN_COMMANDS;
    for (const cmd of commands) {
      if (cmd.id === idOrAlias || cmd.command === idOrAlias || (cmd.aliases && cmd.aliases.includes(idOrAlias))) {
        return cmd;
      }
    }
  }
  if (type === 'alias') {
    const aliases = buildAliasRegistryV2(services);
    for (const entry of aliases) {
      if (entry.alias === idOrAlias || entry.id === idOrAlias) {
        return entry;
      }
    }
  }
  return null;
}

function buildCompatibilityBridgeReport(services) {
  return {
    legacyDashboardCount: getLegacyDashboardRegistryCompat(services).length,
    legacyCommandCount: getLegacyCommandRegistryCompat(services).length,
    legacyCapabilityCount: getLegacyCapabilityRegistryCompat(services).length,
    aliasesResolvable: buildAliasRegistryV2(services).length,
    compatMode: 'full'
  };
}

module.exports = {
  getLegacyDashboardRegistryCompat,
  getLegacyCommandRegistryCompat,
  getLegacyCapabilityRegistryCompat,
  resolveRegistryItemCompat,
  buildCompatibilityBridgeReport
};

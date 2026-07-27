'use strict';

const { buildDashboardTabRegistryV2, normalizeDashboardTabsFromLegacy } = require('./dashboard-tab-registry-v2');
const { buildDashboardApiRegistryV2, normalizeDashboardApisFromLegacy } = require('./dashboard-api-registry-v2');
const { buildTelegramCommandRegistryV2, normalizeTelegramCommandsFromLegacy } = require('./telegram-command-registry-v2');
const { buildCapabilityRegistryV2, normalizeCapabilitiesFromLegacy } = require('./capability-registry-v2');
const { buildAliasRegistryV2, normalizeAliasesFromLegacy } = require('./alias-registry-v2');

function normalizeAllRegistriesV2(services) {
  return {
    dashboard: normalizeDashboardRegistry(services),
    api: normalizeApiRegistry(services),
    command: normalizeCommandRegistry(services),
    capability: normalizeCapabilityRegistry(services),
    alias: normalizeAliasRegistry(services)
  };
}

function normalizeDashboardRegistry(services) {
  const built = buildDashboardTabRegistryV2(services);
  const legacy = normalizeDashboardTabsFromLegacy(services);
  const merged = built.map(b => {
    const l = legacy.find(x => x.id === b.id);
    return l ? { ...b, ...l } : b;
  });
  return merged;
}

function normalizeApiRegistry(services) {
  const built = buildDashboardApiRegistryV2(services);
  const legacy = normalizeDashboardApisFromLegacy(services);
  const merged = built.map(b => {
    const l = legacy.find(x => x.id === b.id);
    return l ? { ...b, ...l } : b;
  });
  return merged;
}

function normalizeCommandRegistry(services) {
  const built = buildTelegramCommandRegistryV2(services);
  const legacy = normalizeTelegramCommandsFromLegacy(services);
  const merged = built.map(b => {
    const l = legacy.find(x => x.id === b.id);
    return l ? { ...b, ...l } : b;
  });
  return merged;
}

function normalizeCapabilityRegistry(services) {
  const built = buildCapabilityRegistryV2(services);
  const legacy = normalizeCapabilitiesFromLegacy(services);
  const merged = built.map(b => {
    const l = legacy.find(x => x.id === b.id);
    return l ? { ...b, ...l } : b;
  });
  return merged;
}

function normalizeAliasRegistry(services) {
  return normalizeAliasesFromLegacy(services);
}

module.exports = {
  normalizeAllRegistriesV2,
  normalizeDashboardRegistry,
  normalizeApiRegistry,
  normalizeCommandRegistry,
  normalizeCapabilityRegistry,
  normalizeAliasRegistry
};

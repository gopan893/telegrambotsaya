'use strict';

const { validateUnifiedItem } = require('./unified-registry-contract');
const { validateDashboardTabRegistryV2 } = require('./dashboard-tab-registry-v2');
const { validateDashboardApiRegistryV2 } = require('./dashboard-api-registry-v2');
const { validateTelegramCommandRegistryV2 } = require('./telegram-command-registry-v2');
const { validateCapabilityRegistryV2, detectUnsafeCapability } = require('./capability-registry-v2');

function validateAllRegistriesV2(services) {
  const errors = {};
  errors.duplicateIds = validateNoDuplicateIds(services);
  errors.aliasConflicts = validateNoAliasConflicts(services);
  errors.dashboardApiMapping = validateDashboardApiMapping(services);
  errors.rendererMapping = validateRendererMapping(services);
  errors.commandHandlerMapping = validateCommandHandlerMapping(services);
  errors.capabilitySafety = validateCapabilitySafety(services);

  const flatErrors = Object.values(errors).flat();
  return {
    valid: flatErrors.length === 0,
    errors,
    summary: flatErrors
  };
}

function validateNoDuplicateIds(services) {
  const errors = [];
  const registries = {
    dashboard_tab: services.dashboardTabs || [],
    dashboard_api: services.dashboardApis || [],
    telegram_command: services.telegramCommands || [],
    capability: services.capabilities || []
  };
  for (const [type, items] of Object.entries(registries)) {
    const ids = new Set();
    for (const item of items) {
      if (ids.has(item.id)) {
        errors.push(`duplicate ${type} id: ${item.id}`);
      }
      ids.add(item.id);
    }
  }
  return errors;
}

function validateNoAliasConflicts(services) {
  const errors = [];
  const aliasMap = new Map();
  const registries = {
    dashboard_tab: services.dashboardTabs || [],
    telegram_command: services.telegramCommands || []
  };
  for (const [type, items] of Object.entries(registries)) {
    for (const item of items) {
      for (const alias of (item.aliases || [])) {
        if (aliasMap.has(alias)) {
          errors.push(`alias conflict: "${alias}" in ${type} item "${item.id}" conflicts with "${aliasMap.get(alias).id}"`);
        }
        aliasMap.set(alias, { type, id: item.id });
      }
    }
  }
  return errors;
}

function validateDashboardApiMapping(services) {
  const errors = [];
  const tabs = services.dashboardTabs || [];
  const apis = services.dashboardApis || [];
  for (const tab of tabs) {
    const matchingApi = apis.find(a => a.tabId === tab.id);
    if (!matchingApi) {
      errors.push(`tab "${tab.id}" has no matching API`);
    }
  }
  for (const api of apis) {
    if (api.protected === false) {
      errors.push(`protected API "${api.id}" is marked unprotected`);
    }
  }
  return errors;
}

function validateRendererMapping(services) {
  const errors = [];
  const tabs = services.dashboardTabs || [];
  for (const tab of tabs) {
    if (!tab.rendererName) {
      errors.push(`tab "${tab.id}" missing rendererName`);
    }
  }
  return errors;
}

function validateCommandHandlerMapping(services) {
  const errors = [];
  const commands = services.telegramCommands || [];
  for (const cmd of commands) {
    if (!cmd.handlerName) {
      errors.push(`command "${cmd.id}" missing handlerName`);
    }
  }
  return errors;
}

function validateCapabilitySafety(services) {
  const errors = [];
  const capabilities = services.capabilities || [];
  const unsafe = detectUnsafeCapability(capabilities, services);
  for (const cap of unsafe) {
    errors.push(`unsafe capability: ${cap.id} - ${cap.reason}`);
  }
  return errors;
}

module.exports = {
  validateAllRegistriesV2,
  validateNoDuplicateIds,
  validateNoAliasConflicts,
  validateDashboardApiMapping,
  validateRendererMapping,
  validateCommandHandlerMapping,
  validateCapabilitySafety
};

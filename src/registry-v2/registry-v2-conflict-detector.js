'use strict';

const { detectUnsafeCapability } = require('./capability-registry-v2');
const { detectCommandAliasConflict } = require('./telegram-command-registry-v2');

function detectRegistryConflicts(services) {
  return {
    dashboard: detectDashboardTabConflicts(services),
    api: detectApiRouteConflicts(services),
    command: detectCommandConflicts(services),
    capability: detectCapabilityConflicts(services)
  };
}

function detectDashboardTabConflicts(services) {
  const conflicts = [];
  const tabs = services.dashboardTabs || [];
  const ids = new Map();
  const aliases = new Map();
  for (const tab of tabs) {
    if (ids.has(tab.id)) {
      conflicts.push({
        type: 'duplicate_tab_id',
        id: tab.id,
        severity: 'P1',
        message: `duplicate stable tab id: ${tab.id}`
      });
    }
    ids.set(tab.id, tab);
    for (const alias of (tab.aliases || [])) {
      if (aliases.has(alias)) {
        conflicts.push({
          type: 'alias_conflict',
          alias,
          severity: 'P2',
          message: `alias "${alias}" conflicts between tabs "${aliases.get(alias)}" and "${tab.id}"`
        });
      }
      aliases.set(alias, tab.id);
    }
  }
  for (const tab of tabs) {
    if (tab.stable && !tab.rendererName) {
      conflicts.push({
        type: 'missing_renderer',
        id: tab.id,
        severity: 'P1',
        message: `stable tab "${tab.id}" missing renderer`
      });
    }
    if (tab.stable && !tab.apiEndpoint) {
      conflicts.push({
        type: 'missing_api_endpoint',
        id: tab.id,
        severity: 'P1',
        message: `stable tab "${tab.id}" missing api endpoint`
      });
    }
  }
  return conflicts;
}

function detectApiRouteConflicts(services) {
  const conflicts = [];
  const apis = services.dashboardApis || [];
  const routeMap = new Map();
  for (const api of apis) {
    const routeKey = `${api.method || 'GET'}:${api.path}`;
    if (routeMap.has(routeKey)) {
      conflicts.push({
        type: 'duplicate_route',
        route: routeKey,
        severity: 'P1',
        message: `duplicate api route ${routeKey} between "${routeMap.get(routeKey)}" and "${api.id}"`
      });
    }
    routeMap.set(routeKey, api.id);
    if (api.protected === false) {
      conflicts.push({
        type: 'unprotected_api',
        id: api.id,
        path: api.path,
        severity: 'P0',
        message: `protected api "${api.id}" is unprotected`
      });
    }
  }
  return conflicts;
}

function detectCommandConflicts(services) {
  const conflicts = [];
  const commands = services.telegramCommands || [];
  const cmdSet = new Set();
  for (const cmd of commands) {
    if (cmdSet.has(cmd.command)) {
      conflicts.push({
        type: 'duplicate_command',
        command: cmd.command,
        severity: 'P1',
        message: `duplicate command: ${cmd.command}`
      });
    }
    cmdSet.add(cmd.command);
  }
  const aliasConflicts = detectCommandAliasConflict(commands, services);
  for (const ac of aliasConflicts) {
    conflicts.push({
      type: 'command_alias_conflict',
      alias: ac.alias,
      severity: ac.severity === 'P2' ? 'P2' : 'P3',
      message: `command alias "${ac.alias}" conflicts between "${ac.command1}" and "${ac.command2}"`
    });
  }
  return conflicts;
}

function detectCapabilityConflicts(services) {
  const conflicts = [];
  const capabilities = services.capabilities || [];
  const ids = new Set();
  for (const cap of capabilities) {
    if (ids.has(cap.id)) {
      conflicts.push({
        type: 'duplicate_capability',
        id: cap.id,
        severity: 'P2',
        message: `duplicate capability id: ${cap.id}`
      });
    }
    ids.add(cap.id);
  }
  const unsafe = detectUnsafeCapability(capabilities, services);
  for (const cap of unsafe) {
    conflicts.push({
      type: 'unsafe_capability',
      id: cap.id,
      action: cap.action,
      severity: 'P0',
      message: `safety bypass: ${cap.reason}`
    });
  }
  return conflicts;
}

function buildRegistryConflictReport(services) {
  const all = detectRegistryConflicts(services);
  const flat = [
    ...all.dashboard,
    ...all.api,
    ...all.command,
    ...all.capability
  ];
  const bySeverity = { P0: [], P1: [], P2: [], P3: [] };
  for (const conflict of flat) {
    if (bySeverity[conflict.severity]) bySeverity[conflict.severity].push(conflict);
  }
  return {
    totalConflicts: flat.length,
    bySeverity: {
      P0: bySeverity.P0.length,
      P1: bySeverity.P1.length,
      P2: bySeverity.P2.length,
      P3: bySeverity.P3.length
    },
    conflicts: flat
  };
}

module.exports = {
  detectRegistryConflicts,
  detectDashboardTabConflicts,
  detectApiRouteConflicts,
  detectCommandConflicts,
  detectCapabilityConflicts,
  buildRegistryConflictReport
};

/**
 * Registry v3 Conflict Detector
 * Detects conflicts between registry v3 items
 */

const contract = require('./registry-v3-contract');

async function detectRegistryV3Conflicts(services) {
  const { registryV3Store } = services;
  const frozen = registryV3Store.getFrozen();

  if (!frozen || !frozen.items) {
    return {
      hasConflicts: false,
      reason: 'No frozen registry to check'
    };
  }

  const conflicts = [];

  const tabConflicts = detectDashboardTabConflictsV3(frozen, services);
  conflicts.push(...tabConflicts);

  const apiConflicts = detectApiRouteConflictsV3(frozen, services);
  conflicts.push(...apiConflicts);

  const rendererConflicts = detectRendererConflictsV3(frozen, services);
  conflicts.push(...rendererConflicts);

  const commandConflicts = detectCommandConflictsV3(frozen, services);
  conflicts.push(...commandConflicts);

  const capabilityConflicts = detectCapabilityConflictsV3(frozen, services);
  conflicts.push(...capabilityConflicts);

  const aliasConflicts = detectAliasConflictsV3(frozen, services);
  conflicts.push(...aliasConflicts);

  const p0Conflicts = conflicts.filter(c => c.severity === 'P0');
  const p1Conflicts = conflicts.filter(c => c.severity === 'P1');
  const p2Conflicts = conflicts.filter(c => c.severity === 'P2');
  const p3Conflicts = conflicts.filter(c => c.severity === 'P3');

  return {
    hasConflicts: conflicts.length > 0,
    conflicts,
    summary: {
      total: conflicts.length,
      p0: p0Conflicts.length,
      p1: p1Conflicts.length,
      p2: p2Conflicts.length,
      p3: p3Conflicts.length
    }
  };
}

function detectDashboardTabConflictsV3(frozen, services) {
  const conflicts = [];
  const tabs = frozen.items.filter(i => i.type === 'dashboard_tab');

  const seenDataTabs = new Map();
  const seenHrefs = new Map();

  for (const tab of tabs) {
    const tabContract = contract.getDashboardTabContract(tab);

    if (seenDataTabs.has(tabContract.dataTab)) {
      conflicts.push({
        type: 'duplicate_data_tab',
        severity: 'P1',
        message: `Duplicate data-tab: ${tabContract.dataTab}`,
        items: [seenDataTabs.get(tabContract.dataTab), tab.id]
      });
    } else {
      seenDataTabs.set(tabContract.dataTab, tab.id);
    }

    if (seenHrefs.has(tabContract.href)) {
      conflicts.push({
        type: 'duplicate_href',
        severity: 'P1',
        message: `Duplicate href: ${tabContract.href}`,
        items: [seenHrefs.get(tabContract.href), tab.id]
      });
    } else {
      seenHrefs.set(tabContract.href, tab.id);
    }

    if (tabContract.fallbackPolicy === 'overview') {
      conflicts.push({
        type: 'invalid_fallback',
        severity: 'P1',
        message: `Tab ${tab.id} cannot fallback to Overview`,
        items: [tab.id]
      });
    }

    if (tab.status === 'active' && !tabContract.stable) {
      conflicts.push({
        type: 'unstable_active_tab',
        severity: 'P2',
        message: `Active tab ${tab.id} marked as unstable`,
        items: [tab.id]
      });
    }
  }

  return conflicts;
}

function detectApiRouteConflictsV3(frozen, services) {
  const conflicts = [];
  const apis = frozen.items.filter(i => i.type === 'dashboard_api');

  const seenPaths = new Map();

  for (const api of apis) {
    const apiContract = contract.getDashboardApiContract(api);
    const pathKey = `${apiContract.method}:${apiContract.path}`;

    if (seenPaths.has(pathKey)) {
      conflicts.push({
        type: 'duplicate_api_route',
        severity: 'P1',
        message: `Duplicate API route: ${apiContract.method} ${apiContract.path}`,
        items: [seenPaths.get(pathKey), api.id]
      });
    } else {
      seenPaths.set(pathKey, api.id);
    }

    if (apiContract.visibility === 'public' && !apiContract.path.includes('/health')) {
      conflicts.push({
        type: 'public_protected_api',
        severity: 'P0',
        message: `Protected API ${api.id} marked as public`,
        items: [api.id]
      });
    }

    if (apiContract.actionType === 'dangerous' && apiContract.directRunAllowed) {
      conflicts.push({
        type: 'dangerous_direct_run',
        severity: 'P0',
        message: `Dangerous API ${api.id} has directRunAllowed=true`,
        items: [api.id]
      });
    }

    if (!apiContract.responseContract || !apiContract.errorContract) {
      conflicts.push({
        type: 'missing_api_contract',
        severity: 'P1',
        message: `API ${api.id} missing response or error contract`,
        items: [api.id]
      });
    }
  }

  return conflicts;
}

function detectRendererConflictsV3(frozen, services) {
  const conflicts = [];
  const renderers = frozen.items.filter(i => i.type === 'dashboard_renderer');

  const seenRendererIds = new Map();
  const seenTabIds = new Map();

  for (const renderer of renderers) {
    if (seenRendererIds.has(renderer.id)) {
      conflicts.push({
        type: 'duplicate_renderer',
        severity: 'P1',
        message: `Duplicate renderer ID: ${renderer.id}`,
        items: [seenRendererIds.get(renderer.id), renderer.id]
      });
    } else {
      seenRendererIds.set(renderer.id, renderer.id);
    }

    if (renderer.tabId && seenTabIds.has(renderer.tabId)) {
      conflicts.push({
        type: 'multiple_renderers_per_tab',
        severity: 'P2',
        message: `Multiple renderers for tab ${renderer.tabId}`,
        items: [seenTabIds.get(renderer.tabId), renderer.id]
      });
    } else if (renderer.tabId) {
      seenTabIds.set(renderer.tabId, renderer.id);
    }
  }

  return conflicts;
}

function detectCommandConflictsV3(frozen, services) {
  const conflicts = [];
  const commands = frozen.items.filter(i => i.type === 'telegram_command');

  const seenCommands = new Map();

  for (const cmd of commands) {
    const cmdContract = contract.getTelegramCommandContract(cmd);

    if (seenCommands.has(cmdContract.command)) {
      conflicts.push({
        type: 'duplicate_command',
        severity: 'P1',
        message: `Duplicate command: ${cmdContract.command}`,
        items: [seenCommands.get(cmdContract.command), cmd.id]
      });
    } else {
      seenCommands.set(cmdContract.command, cmd.id);
    }

    if (cmdContract.actionType === 'dangerous' && cmdContract.directRunAllowed) {
      conflicts.push({
        type: 'dangerous_command_direct_run',
        severity: 'P0',
        message: `Dangerous command ${cmd.id} has directRunAllowed=true`,
        items: [cmd.id]
      });
    }

    if (cmdContract.command.includes('shell') || cmdContract.command.includes('exec')) {
      conflicts.push({
        type: 'shell_command_blocked',
        severity: 'P0',
        message: `Shell command ${cmd.id} is blocked`,
        items: [cmd.id]
      });
    }
  }

  return conflicts;
}

function detectCapabilityConflictsV3(frozen, services) {
  const conflicts = [];
  const capabilities = frozen.items.filter(i => i.type === 'capability');

  for (const cap of capabilities) {
    const capContract = contract.getCapabilityContract(cap);

    if (capContract.actionType === 'dangerous' && capContract.directRunAllowed) {
      conflicts.push({
        type: 'dangerous_capability_direct_run',
        severity: 'P0',
        message: `Dangerous capability ${cap.id} has directRunAllowed=true`,
        items: [cap.id]
      });
    }

    if (capContract.action.includes('shell') || capContract.action.includes('executor')) {
      conflicts.push({
        type: 'shell_capability_blocked',
        severity: 'P0',
        message: `Shell capability ${cap.id} is blocked`,
        items: [cap.id]
      });
    }

    if (capContract.action.includes('auto') && capContract.action.includes('approve')) {
      conflicts.push({
        type: 'auto_approve_blocked',
        severity: 'P0',
        message: `Auto-approve capability ${cap.id} is blocked`,
        items: [cap.id]
      });
    }
  }

  return conflicts;
}

function detectAliasConflictsV3(frozen, services) {
  const conflicts = [];
  const aliasMap = new Map();

  for (const item of frozen.items) {
    if (!item.aliases || item.aliases.length === 0) continue;

    for (const alias of item.aliases) {
      if (aliasMap.has(alias)) {
        conflicts.push({
          type: 'alias_conflict',
          severity: 'P1',
          message: `Alias "${alias}" used by multiple items`,
          items: [aliasMap.get(alias), item.id]
        });
      } else {
        aliasMap.set(alias, item.id);
      }
    }
  }

  return conflicts;
}

function buildRegistryV3ConflictReport(services) {
  const conflictResult = detectRegistryV3Conflicts(services);

  return {
    hasConflicts: conflictResult.hasConflicts,
    summary: conflictResult.summary || {
      total: 0,
      p0: 0,
      p1: 0,
      p2: 0,
      p3: 0
    },
    conflicts: conflictResult.conflicts || [],
    recommendations: generateConflictRecommendations(conflictResult),
    severityLevels: {
      P0: 'Critical: Safety bypass, secret leak, direct dangerous action, app crash',
      P1: 'High: Stable tab/API broken, command conflict, protected route exposed',
      P2: 'Medium: Alias/docs/test mismatch, low-risk duplicate label',
      P3: 'Low: Naming/style cleanup'
    },
    generatedAt: new Date().toISOString()
  };
}

function generateConflictRecommendations(conflictResult) {
  const recommendations = [];

  if (!conflictResult.hasConflicts) {
    recommendations.push('No conflicts detected - registry is clean');
    return recommendations;
  }

  const summary = conflictResult.summary;

  if (summary.p0 > 0) {
    recommendations.push(`CRITICAL: Fix ${summary.p0} P0 conflicts immediately - these are safety issues`);
  }

  if (summary.p1 > 0) {
    recommendations.push(`Fix ${summary.p1} P1 conflicts before freezing - these break functionality`);
  }

  if (summary.p2 > 0) {
    recommendations.push(`Address ${summary.p2} P2 conflicts to improve quality`);
  }

  if (summary.p3 > 0) {
    recommendations.push(`${summary.p3} P3 conflicts can be addressed later`);
  }

  return recommendations;
}

module.exports = {
  detectRegistryV3Conflicts,
  detectDashboardTabConflictsV3,
  detectApiRouteConflictsV3,
  detectRendererConflictsV3,
  detectCommandConflictsV3,
  detectCapabilityConflictsV3,
  detectAliasConflictsV3,
  buildRegistryV3ConflictReport
};

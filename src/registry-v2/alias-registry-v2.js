'use strict';

const { createUnifiedItem } = require('./unified-registry-contract');

function buildAliasRegistryV2(services) {
  const aliases = [];
  if (!services) return aliases;
  const sources = [
    { type: 'dashboard_tab', items: services.dashboardTabs || services.STABLE_TABS || [] },
    { type: 'telegram_command', items: services.telegramCommands || services.BUILTIN_COMMANDS || [] }
  ];
  for (const source of sources) {
    for (const item of source.items) {
      if (item.aliases && Array.isArray(item.aliases)) {
        for (const alias of item.aliases) {
          aliases.push(createUnifiedItem({
            id: `alias-${alias.replace(/[^a-z0-9]/gi, '-')}`,
            type: 'alias',
            module: 'alias-registry-v2',
            alias,
            canonicalId: item.id,
            source: source.type,
            conflictStatus: 'none',
            enabled: true
          }));
        }
      }
    }
  }
  return aliases;
}

function normalizeAliasesFromLegacy(services) {
  return buildAliasRegistryV2(services);
}

function detectAliasConflicts(services) {
  const conflicts = [];
  const aliasMap = new Map();
  const registry = buildAliasRegistryV2(services);
  for (const entry of registry) {
    if (!entry.alias) continue;
    if (aliasMap.has(entry.alias)) {
      conflicts.push({
        alias: entry.alias,
        existing: aliasMap.get(entry.alias),
        current: entry.canonicalId,
        severity: 'P2'
      });
    } else {
      aliasMap.set(entry.alias, entry.canonicalId);
    }
  }
  return conflicts;
}

function resolveAliasConflictSafely(conflict, services) {
  const { alias, existing, current } = conflict;
  const resolution = {
    alias,
    chosen: existing,
    rejected: current,
    strategy: 'keep-existing',
    conflictStatus: 'resolved',
    timestamp: new Date().toISOString()
  };
  return resolution;
}

function buildAliasReport(services) {
  const aliases = buildAliasRegistryV2(services);
  const conflicts = detectAliasConflicts(services);
  const grouped = {};
  for (const alias of aliases) {
    const source = alias.source || 'unknown';
    if (!grouped[source]) grouped[source] = [];
    grouped[source].push({
      alias: alias.alias,
      canonicalId: alias.canonicalId,
      conflictStatus: alias.conflictStatus
    });
  }
  return {
    totalAliases: aliases.length,
    totalConflicts: conflicts.length,
    conflicts,
    grouped
  };
}

module.exports = {
  buildAliasRegistryV2,
  normalizeAliasesFromLegacy,
  detectAliasConflicts,
  resolveAliasConflictSafely,
  buildAliasReport
};

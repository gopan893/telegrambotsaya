'use strict';

const { createUnifiedItem } = require('./unified-registry-contract');

const BUILTIN_COMMANDS = [
  { id: 'cmd-stabilization', command: '/stabilization', aliases: ['/stabilize'], module: 'stabilization', description: 'Run stabilization procedures', riskLevel: 'high', requiresOwner: true, requiresAdmin: true, requiresApproval: true, requiresEvaluation: true, handlerName: 'handleStabilization', enabled: true },
  { id: 'cmd-finalreadiness', command: '/finalreadiness', aliases: ['/readiness'], module: 'readiness', description: 'Check final readiness status', riskLevel: 'medium', requiresOwner: true, requiresAdmin: true, requiresApproval: false, requiresEvaluation: true, handlerName: 'handleFinalReadiness', enabled: true },
  { id: 'cmd-v1lock', command: '/v1lock', aliases: ['/lockv1'], module: 'v1lock', description: 'Lock v1 registry', riskLevel: 'critical', requiresOwner: true, requiresAdmin: true, requiresApproval: true, requiresEvaluation: true, handlerName: 'handleV1Lock', enabled: true },
  { id: 'cmd-controlpanelcert', command: '/controlpanelcert', aliases: ['/cpcert'], module: 'controlpanel', description: 'Certify control panel', riskLevel: 'high', requiresOwner: true, requiresAdmin: true, requiresApproval: true, requiresEvaluation: true, handlerName: 'handleControlPanelCert', enabled: true },
  { id: 'cmd-safetycert', command: '/safetycert', aliases: ['/safety'], module: 'safety', description: 'Run safety certification', riskLevel: 'critical', requiresOwner: true, requiresAdmin: true, requiresApproval: true, requiresEvaluation: true, handlerName: 'handleSafetyCert', enabled: true },
  { id: 'cmd-v2planning', command: '/v2planning', aliases: ['/v2plan'], module: 'v2', description: 'V2 planning interface', riskLevel: 'medium', requiresOwner: false, requiresAdmin: true, requiresApproval: false, requiresEvaluation: false, handlerName: 'handleV2Planning', enabled: true },
  { id: 'cmd-v2scope', command: '/v2scope', aliases: ['/scope'], module: 'v2', description: 'Define V2 scope', riskLevel: 'medium', requiresOwner: false, requiresAdmin: true, requiresApproval: true, requiresEvaluation: false, handlerName: 'handleV2Scope', enabled: true },
  { id: 'cmd-v2migration', command: '/v2migration', aliases: ['/migratev2'], module: 'v2', description: 'Run V2 migration', riskLevel: 'high', requiresOwner: true, requiresAdmin: true, requiresApproval: true, requiresEvaluation: true, handlerName: 'handleV2Migration', enabled: true },
  { id: 'cmd-v2risks', command: '/v2risks', aliases: ['/risks'], module: 'v2', description: 'Assess V2 risks', riskLevel: 'medium', requiresOwner: false, requiresAdmin: true, requiresApproval: false, requiresEvaluation: false, handlerName: 'handleV2Risks', enabled: true },
  { id: 'cmd-v2criteria', command: '/v2criteria', aliases: ['/criteria'], module: 'v2', description: 'Set V2 success criteria', riskLevel: 'low', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, handlerName: 'handleV2Criteria', enabled: true },
  { id: 'cmd-v2decisions', command: '/v2decisions', aliases: ['/decisions'], module: 'v2', description: 'Log V2 decisions', riskLevel: 'low', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, handlerName: 'handleV2Decisions', enabled: true },
  { id: 'cmd-registryv2', command: '/registryv2', aliases: ['/regv2'], module: 'registry-v2', description: 'View registry v2 status', riskLevel: 'low', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, handlerName: 'handleRegistryV2', enabled: true },
  { id: 'cmd-registryvalidate', command: '/registryvalidate', aliases: ['/regvalidate'], module: 'registry-v2', description: 'Validate all registries', riskLevel: 'medium', requiresOwner: false, requiresAdmin: true, requiresApproval: false, requiresEvaluation: false, handlerName: 'handleRegistryValidate', enabled: true },
  { id: 'cmd-registryconflicts', command: '/registryconflicts', aliases: ['/regconflicts'], module: 'registry-v2', description: 'Detect registry conflicts', riskLevel: 'low', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, handlerName: 'handleRegistryConflicts', enabled: true },
  { id: 'cmd-tabregistry', command: '/tabregistry', aliases: ['/tabs'], module: 'registry-v2', description: 'View tab registry', riskLevel: 'low', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, handlerName: 'handleTabRegistry', enabled: true },
  { id: 'cmd-apiregistry', command: '/apiregistry', aliases: ['/apis'], module: 'registry-v2', description: 'View API registry', riskLevel: 'low', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, handlerName: 'handleApiRegistry', enabled: true },
  { id: 'cmd-commandregistry', command: '/commandregistry', aliases: ['/cmds'], module: 'registry-v2', description: 'View command registry', riskLevel: 'low', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, handlerName: 'handleCommandRegistry', enabled: true },
  { id: 'cmd-capabilityregistry', command: '/capabilityregistry', aliases: ['/caps'], module: 'registry-v2', description: 'View capability registry', riskLevel: 'low', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, handlerName: 'handleCapabilityRegistry', enabled: true },
  { id: 'cmd-aliasregistry', command: '/aliasregistry', aliases: ['/aliases'], module: 'registry-v2', description: 'View alias registry', riskLevel: 'low', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, handlerName: 'handleAliasRegistry', enabled: true }
];

function buildTelegramCommandRegistryV2(services) {
  return BUILTIN_COMMANDS.map(cmd => createUnifiedItem({
    ...cmd,
    type: 'telegram_command',
    ownerModule: cmd.module
  }));
}

function normalizeTelegramCommandsFromLegacy(services) {
  if (services && services.legacyCommandRegistry) {
    const legacy = services.legacyCommandRegistry;
    return BUILTIN_COMMANDS.map(cmd => {
      const legacyCmd = legacy.find(l => l.id === cmd.id || l.command === cmd.command);
      return legacyCmd ? { ...cmd, ...legacyCmd } : cmd;
    });
  }
  return [...BUILTIN_COMMANDS];
}

function validateTelegramCommandRegistryV2(registry, services) {
  const errors = [];
  if (!Array.isArray(registry)) return ['registry must be an array'];
  const commands = new Set();
  const allAliases = new Map();
  for (const cmd of registry) {
    if (!cmd.id) errors.push('command missing id');
    if (!cmd.command) errors.push(`command ${cmd.id || 'unknown'} missing command`);
    if (commands.has(cmd.command)) errors.push(`duplicate command: ${cmd.command}`);
    commands.add(cmd.command);
    for (const alias of (cmd.aliases || [])) {
      if (allAliases.has(alias)) errors.push(`alias conflict: ${alias} used by ${allAliases.get(alias)} and ${cmd.id}`);
      allAliases.set(alias, cmd.id);
    }
  }
  return errors;
}

function detectCommandAliasConflict(registry, services) {
  const conflicts = [];
  const aliasMap = new Map();
  for (const cmd of registry) {
    for (const alias of (cmd.aliases || [])) {
      if (aliasMap.has(alias)) {
        conflicts.push({
          alias,
          command1: aliasMap.get(alias),
          command2: cmd.id,
          severity: 'P2'
        });
      } else {
        aliasMap.set(alias, cmd.id);
      }
    }
  }
  return conflicts;
}

function generateCommandDocsFromRegistry(registry, services) {
  return registry
    .filter(cmd => cmd.enabled)
    .map(cmd => ({
      command: cmd.command,
      description: cmd.description,
      aliases: cmd.aliases,
      riskLevel: cmd.riskLevel,
      requiresOwner: cmd.requiresOwner,
      requiresAdmin: cmd.requiresAdmin,
      requiresApproval: cmd.requiresApproval
    }));
}

module.exports = {
  BUILTIN_COMMANDS,
  buildTelegramCommandRegistryV2,
  normalizeTelegramCommandsFromLegacy,
  validateTelegramCommandRegistryV2,
  detectCommandAliasConflict,
  generateCommandDocsFromRegistry
};

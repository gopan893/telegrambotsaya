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
  { id: 'cmd-aliasregistry', command: '/aliasregistry', aliases: ['/aliases'], module: 'registry-v2', description: 'View alias registry', riskLevel: 'low', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, handlerName: 'handleAliasRegistry', enabled: true },
  { id: 'cmd-pluginhardening', command: '/pluginhardening', aliases: ['/phardening'], module: 'plugin-hardening', description: 'Plugin hardening status', riskLevel: 'low', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, handlerName: 'handlePluginHardening', enabled: true },
  { id: 'cmd-plugincompat', command: '/plugincompat', aliases: ['/pcompat'], module: 'plugin-hardening', description: 'Check plugin compatibility', riskLevel: 'low', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, handlerName: 'handlePluginCompat', enabled: true },
  { id: 'cmd-pluginpermissions', command: '/pluginpermissions', aliases: ['/pperms'], module: 'plugin-hardening', description: 'Check plugin permissions', riskLevel: 'low', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, handlerName: 'handlePluginPermissions', enabled: true },
  { id: 'cmd-pluginsandbox', command: '/pluginsandbox', aliases: ['/psandbox'], module: 'plugin-hardening', description: 'Check plugin sandbox', riskLevel: 'low', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, handlerName: 'handlePluginSandbox', enabled: true },
  { id: 'cmd-plugincert', command: '/plugincert', aliases: ['/pcert'], module: 'plugin-hardening', description: 'Certify plugin', riskLevel: 'medium', requiresOwner: false, requiresAdmin: true, requiresApproval: false, requiresEvaluation: false, handlerName: 'handlePluginCert', enabled: true },
  { id: 'cmd-connectortest', command: '/connectortest', aliases: ['/ctest'], module: 'connector-hardening', description: 'Test connector', riskLevel: 'low', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, handlerName: 'handleConnectorTest', enabled: true },
  { id: 'cmd-ragquality', command: '/ragquality', aliases: ['/rq'], module: 'rag-quality', description: 'Check RAG quality', riskLevel: 'low', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, handlerName: 'handleRagQuality', enabled: true },
  { id: 'cmd-sourceconfidence', command: '/sourceconfidence', aliases: ['/sconf'], module: 'rag-quality', description: 'Check source confidence', riskLevel: 'low', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, handlerName: 'handleSourceConfidence', enabled: true },
  { id: 'cmd-sourcefreshness', command: '/sourcefreshness', aliases: ['/sfresh'], module: 'rag-quality', description: 'Check source freshness', riskLevel: 'low', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, handlerName: 'handleSourceFreshness', enabled: true },
  { id: 'cmd-retrievalquality', command: '/retrievalquality', aliases: ['/rqual'], module: 'rag-quality', description: 'Check retrieval quality', riskLevel: 'low', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, handlerName: 'handleRetrievalQuality', enabled: true },
  { id: 'cmd-contextcompress', command: '/contextcompress', aliases: ['/ccompress'], module: 'rag-quality', description: 'Compress context', riskLevel: 'low', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, handlerName: 'handleContextCompress', enabled: true },
  { id: 'cmd-hallucinationguard', command: '/hallucinationguard', aliases: ['/hguard'], module: 'rag-quality', description: 'Check hallucination guard', riskLevel: 'low', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, handlerName: 'handleHallucinationGuard', enabled: true },
  { id: 'cmd-memoryduplicates', command: '/memoryduplicates', aliases: ['/mdup'], module: 'memory-intelligence', description: 'Check memory duplicates', riskLevel: 'low', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, handlerName: 'handleMemoryDuplicates', enabled: true },
  { id: 'cmd-memorymergeplan', command: '/memorymergeplan', aliases: ['/mmerge'], module: 'memory-intelligence', description: 'Memory merge plan', riskLevel: 'medium', requiresOwner: false, requiresAdmin: true, requiresApproval: true, requiresEvaluation: false, handlerName: 'handleMemoryMergePlan', enabled: true },
  { id: 'cmd-memoryconflicts', command: '/memoryconflicts', aliases: ['/mconf'], module: 'memory-intelligence', description: 'Check memory conflicts', riskLevel: 'low', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, handlerName: 'handleMemoryConflicts', enabled: true },
  { id: 'cmd-memoryscore', command: '/memoryscore', aliases: ['/mscore'], module: 'memory-intelligence', description: 'Memory quality score', riskLevel: 'low', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, handlerName: 'handleMemoryScore', enabled: true },
  { id: 'cmd-agentruntime', command: '/agentruntime', aliases: ['/art'], module: 'agent-runtime', description: 'Agent runtime status', riskLevel: 'low', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, handlerName: 'handleAgentRuntime', enabled: true },
  { id: 'cmd-agentload', command: '/agentload', aliases: ['/aload'], module: 'agent-runtime', description: 'Check agent load', riskLevel: 'low', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, handlerName: 'handleAgentLoad', enabled: true },
  { id: 'cmd-agentquality', command: '/agentquality', aliases: ['/aqual'], module: 'agent-runtime', description: 'Check agent quality', riskLevel: 'low', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, handlerName: 'handleAgentQuality', enabled: true },
  { id: 'cmd-modelstrategy', command: '/modelstrategy', aliases: ['/mstrat'], module: 'model-strategy', description: 'Model strategy', riskLevel: 'low', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, handlerName: 'handleModelStrategy', enabled: true },
  { id: 'cmd-modelroute', command: '/modelroute', aliases: ['/mroute'], module: 'model-strategy', description: 'Model route', riskLevel: 'low', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, handlerName: 'handleModelRoute', enabled: true },
  { id: 'cmd-modelfallback', command: '/modelfallback', aliases: ['/mfallback'], module: 'model-strategy', description: 'Model fallback', riskLevel: 'low', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, handlerName: 'handleModelFallback', enabled: true },
  { id: 'cmd-modelcost', command: '/modelcost', aliases: ['/mcost'], module: 'model-strategy', description: 'Model cost', riskLevel: 'low', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, handlerName: 'handleModelCost', enabled: true },
  { id: 'cmd-modellatency', command: '/modellatency', aliases: ['/mlat'], module: 'model-strategy', description: 'Model latency', riskLevel: 'low', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, handlerName: 'handleModelLatency', enabled: true },
  { id: 'cmd-modelprivacy', command: '/modelprivacy', aliases: ['/mpriv'], module: 'model-strategy', description: 'Model privacy', riskLevel: 'low', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, handlerName: 'handleModelPrivacy', enabled: true },
  { id: 'cmd-modelbudget', command: '/modelbudget', aliases: ['/mbudget'], module: 'model-strategy', description: 'Model budget', riskLevel: 'low', requiresOwner: false, requiresAdmin: false, requiresApproval: false, requiresEvaluation: false, handlerName: 'handleModelBudget', enabled: true },
  { id: 'cmd-benchmarkplan', command: '/benchmarkplan', aliases: ['/bmplan'], module: 'model-strategy', description: 'Benchmark plan', riskLevel: 'low', requiresOwner: false, requiresAdmin: true, requiresApproval: false, requiresEvaluation: false, handlerName: 'handleBenchmarkPlan', enabled: true }
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

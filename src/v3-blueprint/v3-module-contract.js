'use strict';

const {
  moduleContracts,
  getStats
} = require('./v3-blueprint-store');

const {
  sanitizeBlueprintOutput,
  generateBlueprintId,
  isSecretOrCredentialValue
} = require('./v3-blueprint-utils');

const REQUIRED_FIELDS = [
  'id', 'module', 'version', 'category', 'criticality',
  'entrypoints', 'dashboardTabs', 'apiRoutes', 'telegramCommands',
  'capabilities', 'storageAccess', 'envContracts',
  'dependencies', 'optionalDependencies', 'safetyBoundary',
  'testFiles', 'docsFiles', 'ownerModule'
];

const CRITICALITY_LEVELS = ['critical', 'high', 'medium', 'low'];
const RISK_LEVELS = ['read', 'report', 'internal_write', 'external_write', 'dangerous', 'blocked'];

const CORE_MODULE_TEMPLATES = {
  'telegram-control': {
    module: 'telegram-control',
    version: '3.0.0-blueprint',
    category: 'runtime',
    criticality: 'critical',
    entrypoints: ['telegram-update-normalizer', 'telegram-runtime-dispatcher'],
    dashboardTabs: ['telegram-control'],
    apiRoutes: ['/api/dashboard/telegram-control/*'],
    telegramCommands: ['/help', '/status', '/handoff', '/plan', '/improve'],
    capabilities: ['read-messages', 'send-messages', 'classify-intent', 'route-commands'],
    storageAccess: ['command-registry', 'session-context', 'audit-log'],
    envContracts: ['TELEGRAM_TOKEN'],
    dependencies: ['registry-v2'],
    optionalDependencies: [],
    safetyBoundary: 'write_external_danger_proposal_only',
    testFiles: ['test-telegram-ux', 'test-natural-chat-stable-release'],
    docsFiles: ['TELEGRAM_CONTROL.md'],
    ownerModule: 'telegram-control'
  },
  'executor': {
    module: 'executor',
    version: '3.0.0-blueprint',
    category: 'governance',
    criticality: 'critical',
    entrypoints: ['executor-registry', 'execution-store', 'approved-runner'],
    dashboardTabs: ['executor'],
    apiRoutes: ['/api/dashboard/executor/*'],
    telegramCommands: ['/approve', '/runexec', '/proposal'],
    capabilities: ['approve-proposals', 'run-approved', 'manage-executions', 'reject-proposals'],
    storageAccess: ['execution-store', 'audit-log'],
    envContracts: [],
    dependencies: ['governance'],
    optionalDependencies: [],
    safetyBoundary: 'write_external_danger_proposal_only',
    testFiles: ['test-executor-boundary-stable-release'],
    docsFiles: ['EXECUTOR.md'],
    ownerModule: 'executor'
  },
  'governance': {
    module: 'governance',
    version: '3.0.0-blueprint',
    category: 'governance',
    criticality: 'critical',
    entrypoints: ['capability-registry', 'unified-permission-engine', 'unified-risk-engine'],
    dashboardTabs: ['governance'],
    apiRoutes: ['/api/dashboard/governance/*'],
    telegramCommands: [],
    capabilities: ['evaluate-actions', 'classify-risk', 'enforce-permissions'],
    storageAccess: ['governance-policy-store', 'audit-log'],
    envContracts: [],
    dependencies: ['registry-v2'],
    optionalDependencies: ['security', 'privacy'],
    safetyBoundary: 'write_external_danger_proposal_only',
    testFiles: ['test-unified-evaluation-policy'],
    docsFiles: ['GOVERNANCE.md'],
    ownerModule: 'governance'
  },
  'security': {
    module: 'security',
    version: '3.0.0-blueprint',
    category: 'security',
    criticality: 'critical',
    entrypoints: ['secret-surface-scanner', 'env-drift-detector', 'permission-auditor'],
    dashboardTabs: ['security'],
    apiRoutes: ['/api/dashboard/security/*'],
    telegramCommands: [],
    capabilities: ['scan-secrets', 'detect-drift', 'audit-permissions', 'simulate-red-team'],
    storageAccess: ['security-audit-store'],
    envContracts: [],
    dependencies: ['governance'],
    optionalDependencies: ['privacy'],
    safetyBoundary: 'read_report_only',
    testFiles: ['test-phase48-security-regression'],
    docsFiles: ['SECURITY.md'],
    ownerModule: 'security'
  },
  'privacy': {
    module: 'privacy',
    version: '3.0.0-blueprint',
    category: 'privacy',
    criticality: 'high',
    entrypoints: ['data-inventory-scanner', 'privacy-access-guard', 'export-control-manager'],
    dashboardTabs: ['privacy'],
    apiRoutes: ['/api/dashboard/privacy/*'],
    telegramCommands: [],
    capabilities: ['scan-data-inventory', 'enforce-privacy-access', 'manage-exports', 'manage-retention'],
    storageAccess: ['privacy-store'],
    envContracts: [],
    dependencies: ['security'],
    optionalDependencies: [],
    safetyBoundary: 'read_report_owner_only',
    testFiles: ['test-phase49-privacy-regression'],
    docsFiles: ['PRIVACY.md'],
    ownerModule: 'privacy'
  },
  'dashboard': {
    module: 'dashboard',
    version: '3.0.0-blueprint',
    category: 'control_plane',
    criticality: 'critical',
    entrypoints: ['dashboard-api-routes', 'dashboard-registry'],
    dashboardTabs: ['overview'],
    apiRoutes: ['/api/dashboard/*'],
    telegramCommands: [],
    capabilities: ['render-dashboard', 'serve-api', 'manage-routes'],
    storageAccess: ['dashboard-config'],
    envContracts: ['DASHBOARD_ADMIN_TOKEN', 'DASHBOARD_WRITE_TOKEN', 'DASHBOARD_DANGER_TOKEN'],
    dependencies: ['registry-v2'],
    optionalDependencies: [],
    safetyBoundary: 'write_external_danger_proposal_only',
    testFiles: ['test-dashboard-router-registry'],
    docsFiles: ['DASHBOARD.md'],
    ownerModule: 'dashboard'
  },
  'storage': {
    module: 'storage',
    version: '3.0.0-blueprint',
    category: 'storage',
    criticality: 'critical',
    entrypoints: ['storage-manager', 'migrations'],
    dashboardTabs: [],
    apiRoutes: ['/api/dashboard/storage/*'],
    telegramCommands: [],
    capabilities: ['read-write-storage', 'run-migrations'],
    storageAccess: ['postgres-primary', 'redis-optional'],
    envContracts: ['DATABASE_URL', 'REDIS_URL', 'STORAGE_DRIVER'],
    dependencies: [],
    optionalDependencies: [],
    safetyBoundary: 'no_destructive_migration',
    testFiles: [],
    docsFiles: ['STORAGE.md'],
    ownerModule: 'storage'
  },
  'workflow-studio': {
    module: 'workflow-studio',
    version: '3.0.0-blueprint',
    category: 'runtime',
    criticality: 'high',
    entrypoints: ['workflow-store', 'workflow-builder', 'workflow-proposal-bridge'],
    dashboardTabs: ['workflows'],
    apiRoutes: ['/api/dashboard/workflow-studio/*'],
    telegramCommands: [],
    capabilities: ['build-workflows', 'simulate-workflows', 'execute-workflows'],
    storageAccess: ['workflow-store'],
    envContracts: [],
    dependencies: ['executor', 'governance'],
    optionalDependencies: ['devices', 'plugins', 'rag-kb'],
    safetyBoundary: 'write_external_danger_proposal_only',
    testFiles: ['test-workflow-approval-mapper'],
    docsFiles: ['WORKFLOW.md'],
    ownerModule: 'workflow-studio'
  },
  'devices': {
    module: 'devices',
    version: '3.0.0-blueprint',
    category: 'runtime',
    criticality: 'high',
    entrypoints: ['device-registry', 'device-proposal-bridge'],
    dashboardTabs: ['devices'],
    apiRoutes: ['/api/dashboard/devices/*'],
    telegramCommands: [],
    capabilities: ['pair-devices', 'monitor-devices', 'control-devices'],
    storageAccess: ['device-store'],
    envContracts: [],
    dependencies: ['governance'],
    optionalDependencies: ['workflow-studio'],
    safetyBoundary: 'write_external_danger_proposal_only',
    testFiles: [],
    docsFiles: ['DEVICES.md'],
    ownerModule: 'devices'
  },
  'plugins': {
    module: 'plugins',
    version: '3.0.0-blueprint',
    category: 'runtime',
    criticality: 'high',
    entrypoints: ['plugin-store', 'plugin-lifecycle-manager', 'plugin-sandbox'],
    dashboardTabs: ['plugins'],
    apiRoutes: ['/api/dashboard/plugins/*'],
    telegramCommands: [],
    capabilities: ['install-plugins', 'enable-plugins', 'disable-plugins', 'verify-plugins'],
    storageAccess: ['plugin-store'],
    envContracts: [],
    dependencies: ['governance'],
    optionalDependencies: ['workflow-studio'],
    safetyBoundary: 'plugin_sandbox_required',
    testFiles: ['test-plugin-event-bus'],
    docsFiles: ['PLUGINS.md'],
    ownerModule: 'plugins'
  },
  'rag-kb': {
    module: 'rag-kb',
    version: '3.0.0-blueprint',
    category: 'runtime',
    criticality: 'high',
    entrypoints: ['rag-document-store', 'rag-hybrid-searcher', 'rag-context-builder'],
    dashboardTabs: ['rag-kb'],
    apiRoutes: ['/api/dashboard/rag-kb/*'],
    telegramCommands: [],
    capabilities: ['search-knowledge', 'index-documents', 'build-context'],
    storageAccess: ['rag-document-store'],
    envContracts: [],
    dependencies: [],
    optionalDependencies: ['model-router'],
    safetyBoundary: 'read_report_only',
    testFiles: ['test-rag-document-store'],
    docsFiles: ['RAG.md'],
    ownerModule: 'rag-kb'
  },
  'model-router': {
    module: 'model-router',
    version: '3.0.0-blueprint',
    category: 'runtime',
    criticality: 'high',
    entrypoints: ['model-routing-decision-engine', 'model-provider-registry'],
    dashboardTabs: ['model-router'],
    apiRoutes: ['/api/dashboard/model-router/*'],
    telegramCommands: [],
    capabilities: ['route-model-requests', 'select-provider', 'manage-fallback'],
    storageAccess: ['model-router-store'],
    envContracts: ['MISTRAL_API_KEY', 'GROQ_API_KEY'],
    dependencies: [],
    optionalDependencies: ['rag-kb'],
    safetyBoundary: 'secret_redaction_api_keys',
    testFiles: [],
    docsFiles: ['MODEL_ROUTER.md'],
    ownerModule: 'model-router'
  }
};

function buildV3ModuleContract(moduleName, services) {
  const template = CORE_MODULE_TEMPLATES[moduleName];
  if (!template) {
    return null;
  }

  const contract = {
    id: generateBlueprintId(`module-${moduleName}`),
    ...template,
    validated: false,
    gaps: [],
    generatedAt: new Date().toISOString()
  };

  const validation = validateV3ModuleContract(contract, services);
  contract.validated = validation.valid;
  contract.gaps = validation.gaps || [];

  const sanitized = sanitizeBlueprintOutput(contract);
  moduleContracts.set(contract.id, sanitized);
  return sanitized;
}

function validateV3ModuleContract(contract, services) {
  const gaps = [];
  let valid = true;

  if (!contract) {
    return { valid: false, gaps: [{ field: 'contract', issue: 'Contract is null or undefined' }] };
  }

  for (const field of REQUIRED_FIELDS) {
    if (contract[field] === undefined || contract[field] === null) {
      gaps.push({ field, issue: `Missing required field: ${field}` });
      valid = false;
    }
  }

  if (contract.criticality && !CRITICALITY_LEVELS.includes(contract.criticality)) {
    gaps.push({ field: 'criticality', issue: `Invalid criticality: ${contract.criticality}` });
    valid = false;
  }

  if (contract.criticality === 'critical') {
    if (!contract.testFiles || contract.testFiles.length === 0) {
      gaps.push({ field: 'testFiles', issue: 'Critical module missing test files', severity: 'high' });
    }
    if (!contract.docsFiles || contract.docsFiles.length === 0) {
      gaps.push({ field: 'docsFiles', issue: 'Critical module missing documentation files', severity: 'high' });
    }
  }

  if (contract.capabilities && Array.isArray(contract.capabilities)) {
    for (const cap of contract.capabilities) {
      if (typeof cap === 'string' && (cap.includes('danger') || cap.includes('delete') || cap.includes('destroy'))) {
        const hasSafety =
          contract.safetyBoundary &&
          (contract.safetyBoundary.includes('proposal') || contract.safetyBoundary.includes('evaluation'));
        if (!hasSafety) {
          gaps.push({ field: 'safetyBoundary', issue: `Dangerous capability "${cap}" requires proposal/evaluation declaration`, severity: 'critical' });
        }
      }
    }
  }

  if (contract.optionalDependencies && Array.isArray(contract.optionalDependencies)) {
    for (const dep of contract.optionalDependencies) {
      if (!Array.isArray(contract.optionalDependencies)) {
        gaps.push({ field: 'optionalDependencies', issue: 'Optional dependency must have guarded import pattern' });
      }
    }
  }

  if (contract.envContracts && Array.isArray(contract.envContracts)) {
    const secretEnvKeys = [
      'TELEGRAM_TOKEN', 'DATABASE_URL', 'REDIS_URL', 'GITHUB_TOKEN',
      'DASHBOARD_ADMIN_TOKEN', 'DASHBOARD_WRITE_TOKEN', 'DASHBOARD_DANGER_TOKEN',
      'MISTRAL_API_KEY', 'GROQ_API_KEY', 'GOOGLE_CLIENT_SECRET',
      'CLOUDFLARE_API_TOKEN', 'TAVILY_API_KEY', 'OPENWEATHER_API_KEY'
    ];
    for (const envKey of contract.envContracts) {
      if (secretEnvKeys.includes(envKey)) {
        gaps.push({
          field: 'envContracts',
          issue: `Secret env contract "${envKey}" declared; must never expose raw value`,
          severity: 'info'
        });
      }
    }
  }

  if (contract.capabilities && Array.isArray(contract.capabilities)) {
    const dangerousCaps = contract.capabilities.filter(c =>
      c.includes('delete') || c.includes('destroy') || c.includes('deploy') ||
      c.includes('push') || c.includes('rollback') || c.includes('restore') ||
      c.includes('shell') || c.includes('exec')
    );
    for (const cap of dangerousCaps) {
      gaps.push({
        field: 'capabilities',
        issue: `Dangerous capability "${cap}" must declare approval/evaluation in safetyBoundary`,
        severity: 'critical'
      });
    }
  }

  return { valid, gaps: sanitizeBlueprintOutput(gaps) };
}

function detectV3ModuleContractGaps(services) {
  const allGaps = [];
  const moduleNames = Object.keys(CORE_MODULE_TEMPLATES);

  for (const name of moduleNames) {
    const contract = buildV3ModuleContract(name, services);
    if (contract && contract.gaps && contract.gaps.length > 0) {
      allGaps.push({
        module: name,
        criticality: contract.criticality,
        gapCount: contract.gaps.length,
        gaps: contract.gaps
      });
    }
  }

  return sanitizeBlueprintOutput({
    type: 'module_contract_gaps',
    generatedAt: new Date().toISOString(),
    totalModules: moduleNames.length,
    modulesWithGaps: allGaps.length,
    details: allGaps
  });
}

function buildV3ModuleContractReport(services) {
  const contracts = [];
  const moduleNames = Object.keys(CORE_MODULE_TEMPLATES);

  for (const name of moduleNames) {
    const contract = buildV3ModuleContract(name, services);
    contracts.push({
      module: name,
      id: contract ? contract.id : null,
      criticality: contract ? contract.criticality : 'unknown',
      validated: contract ? contract.validated : false,
      gapCount: (contract && contract.gaps) ? contract.gaps.length : 0
    });
  }

  const criticalModules = contracts.filter(c => c.criticality === 'critical');
  const criticalWithGaps = criticalModules.filter(c => c.gapCount > 0);

  return sanitizeBlueprintOutput({
    reportId: generateBlueprintId('mod-contract-report'),
    type: 'v3_module_contract_report',
    generatedAt: new Date().toISOString(),
    summary: {
      totalModules: contracts.length,
      criticalModules: criticalModules.length,
      criticalModulesWithGaps: criticalWithGaps.length,
      fullyValidated: contracts.filter(c => c.validated && c.gapCount === 0).length
    },
    modules: contracts,
    stats: getStats(),
    recommendations: [
      'Address missing test files for critical modules',
      'Add documentation files for modules without docs',
      'Review dangerous capability declarations',
      'Ensure all optional dependencies have guarded imports'
    ]
  });
}

module.exports = {
  buildV3ModuleContract,
  validateV3ModuleContract,
  detectV3ModuleContractGaps,
  buildV3ModuleContractReport
};
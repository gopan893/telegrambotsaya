'use strict';

const utils = require('./release-utils');

const MODULES = [
  { name: 'core-bot', path: 'src/bot/index.js', optional: false },
  { name: 'storage', path: 'src/storage/index.js', optional: false },
  { name: 'dashboard', path: 'src/dashboard/index.js', optional: false },
  { name: 'agents', path: 'src/agents/index.js', optional: false },
  { name: 'executor', path: 'src/executor/index.js', optional: false },
  { name: 'evaluation', path: 'src/agents/agent-evaluation-harness.js', optional: false },
  { name: 'integrations', path: 'src/integrations/index.js', optional: true },
  { name: 'coding-workspace', path: 'src/coding/index.js', optional: true },
  { name: 'routines', path: 'src/routines/index.js', optional: true },
  { name: 'selfhealing', path: 'src/selfhealing/index.js', optional: true },
  { name: 'monitoring', path: 'src/monitoring/index.js', optional: true },
  { name: 'cicd', path: 'src/cicd/index.js', optional: true },
  { name: 'githubops', path: 'src/githubops/index.js', optional: true },
  { name: 'deploy', path: 'src/deploy/index.js', optional: true },
  { name: 'observability', path: 'src/observability/index.js', optional: true },
  { name: 'cost', path: 'src/cost/index.js', optional: true },
  { name: 'operator', path: 'src/operator/index.js', optional: true },
  { name: 'portfolio', path: 'src/portfolio/index.js', optional: true },
  { name: 'knowledge', path: 'src/knowledge/index.js', optional: true },
  { name: 'lifeos', path: 'src/lifeos/index.js', optional: true },
  { name: 'telegram-control', path: 'src/telegram-control/index.js', optional: true },
  { name: 'operating-loop', path: 'src/operating-loop/index.js', optional: true },
  { name: 'improvement', path: 'src/improvement/index.js', optional: true },
  { name: 'governance', path: 'src/governance/index.js', optional: true },
  { name: 'security', path: 'src/security/index.js', optional: true },
  { name: 'privacy', path: 'src/privacy/index.js', optional: true },
  { name: 'backup', path: 'src/backup/index.js', optional: true },
  { name: 'memory', path: 'src/memory/index.js', optional: true },
  { name: 'goals', path: 'src/ai-os/goal-manager.js', optional: false },
  { name: 'workflows', path: 'src/ai-os/workflow-engine.js', optional: true }
];

function checkAllModuleReadiness(services = {}) {
  const results = [];
  const env = services.env || process.env || {};
  const storageManager = services.storageManager || null;

  for (const mod of MODULES) {
    const result = checkModuleReadiness(mod.name, services);
    results.push(result);
  }

  const missingAdapters = detectMissingModuleAdapters(services);
  const brokenImports = detectBrokenModuleImports(services);
  const duplicates = detectDuplicateModules(services);

  return {
    results,
    summary: buildModuleSummary(results),
    missingAdapters,
    brokenImports,
    duplicates,
    timestamp: utils.formatTimestamp()
  };
}

function checkModuleReadiness(moduleName, services = {}) {
  const env = services.env || process.env || {};
  const mod = MODULES.find(m => m.name === moduleName);
  if (!mod) {
    return { name: moduleName, status: 'unknown', error: 'Module not in registry' };
  }

  let status = 'unknown';
  let errors = [];
  let warnings = [];

  try {
    const resolved = require.resolve('../' + mod.path);
    if (resolved) {
      status = 'ready';
      try {
        const modExports = require('../' + mod.path);
        if (modExports && typeof modExports === 'object' && Object.keys(modExports).length === 0) {
          warnings.push('Module exports may be empty');
          if (status === 'ready') status = 'degraded';
        }
      } catch (loadErr) {
        if (mod.optional) {
          status = 'missing_optional';
          warnings.push('Optional module failed to load: ' + loadErr.message);
        } else {
          status = 'blocked';
          errors.push('Required module failed to load: ' + loadErr.message);
        }
      }
    }
  } catch (resolveErr) {
    if (mod.optional) {
      status = 'missing_optional';
      warnings.push('Optional module path not found: ' + mod.path);
    } else {
      status = 'blocked';
      errors.push('Required module path not found: ' + mod.path);
    }
  }

  return {
    name: moduleName,
    path: mod.path,
    optional: mod.optional,
    status,
    errors,
    warnings
  };
}

function detectMissingModuleAdapters(services = {}) {
  const env = services.env || process.env || {};
  const found = [];

  const knownAdapters = ['postgres', 'redis', 'json', 'telegram', 'openai', 'claude', 'gemini'];
  for (const adapter of knownAdapters) {
    try {
      const adapterPath = 'src/storage/' + adapter + '-adapter.js';
      require.resolve('../' + adapterPath);
    } catch (e) {
      if (adapter === 'postgres' || adapter === 'json') {
        found.push({ adapter, missing: true, critical: true });
      }
    }
  }

  return found;
}

function detectBrokenModuleImports(services = {}) {
  const broken = [];
  const modulesToCheck = [
    'src/bot/message-handler.js',
    'src/dashboard/dashboard-routes.js',
    'src/bot/legacy-runtime.js'
  ];
  for (const modPath of modulesToCheck) {
    try {
      require.resolve('../' + modPath);
    } catch (e) {
      broken.push({ path: modPath, error: e.message });
    }
  }
  return broken;
}

function detectDuplicateModules(services = {}) {
  const knownDuplicates = [
    { a: 'src/ai-os/knowledge-graph.js', b: 'src/knowledge/knowledge-graph-store.js', note: 'Knowledge graph core vs store adapter' },
    { a: 'src/agents/council-engine.js', b: 'src/collaboration/collaborative-reasoning.js', note: 'Council vs collaboration (different concerns)' },
    { a: 'src/deploy/release-candidate-manager.js', b: 'src/release/release-candidate-store.js', note: 'Old RC manager vs Phase 50 RC store' }
  ];
  return knownDuplicates.filter(d => {
    try {
      require.resolve('../' + d.a);
      require.resolve('../' + d.b);
      return true;
    } catch (e) {
      return false;
    }
  });
}

function buildModuleSummary(results) {
  const counts = { ready: 0, degraded: 0, missing_optional: 0, blocked: 0, unknown: 0 };
  for (const r of results) {
    if (counts[r.status] !== undefined) counts[r.status]++;
  }
  const total = results.length;
  const score = total > 0 ? Math.round(((counts.ready + counts.missing_optional) / total) * 100) : 0;
  return {
    total,
    ...counts,
    score,
    blockedModules: results.filter(r => r.status === 'blocked').map(r => r.name),
    degradedModules: results.filter(r => r.status === 'degraded').map(r => r.name),
    allReady: counts.blocked === 0
  };
}

function buildModuleReadinessReport(results) {
  return {
    summary: results.summary || buildModuleSummary(results.results || results),
    details: results.results || results,
    missingAdapters: results.missingAdapters || [],
    brokenImports: results.brokenImports || [],
    duplicates: results.duplicates || [],
    timestamp: utils.formatTimestamp()
  };
}

module.exports = {
  checkAllModuleReadiness,
  checkModuleReadiness,
  detectMissingModuleAdapters,
  detectBrokenModuleImports,
  detectDuplicateModules,
  buildModuleReadinessReport,
  MODULES
};

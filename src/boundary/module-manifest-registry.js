'use strict';

const store = require('./module-boundary-store');
const utils = require('./module-boundary-utils');

const ALL_MODULE_NAMES = [
  'core', 'dashboard', 'telegram-control', 'agents', 'executor', 'evaluation',
  'governance', 'security', 'privacy', 'reliability', 'release', 'registry-v2',
  'stabilization', 'v2-planning', 'integrations', 'coding', 'routines',
  'monitoring', 'githubops', 'deploy', 'observability', 'cost', 'operator',
  'portfolio', 'knowledge', 'lifeos', 'operating-loop', 'improvement',
  'research', 'docs-intel', 'model-router', 'plugins', 'rag', 'recipes',
  'mobile', 'disaster-recovery', 'consolidation', 'boundary', 'performance', 'v2-release'
];

const MODULE_CRITICALITY = {
  core: 'critical', dashboard: 'important', 'telegram-control': 'critical',
  agents: 'critical', executor: 'critical', evaluation: 'important',
  governance: 'critical', security: 'critical', privacy: 'critical',
  reliability: 'important', release: 'important', 'registry-v2': 'important',
  stabilization: 'important', 'v2-planning': 'optional', integrations: 'important',
  coding: 'important', routines: 'important', monitoring: 'important',
  githubops: 'important', deploy: 'important', observability: 'important',
  cost: 'important', operator: 'critical', portfolio: 'optional',
  knowledge: 'important', lifeos: 'critical', 'operating-loop': 'important',
  improvement: 'optional', research: 'optional', 'docs-intel': 'optional',
  'model-router': 'experimental', plugins: 'optional', rag: 'optional',
  recipes: 'experimental', mobile: 'optional', 'disaster-recovery': 'critical',
  consolidation: 'important', boundary: 'important', performance: 'important',
  'v2-release': 'critical'
};

function _ensurePrepopulated(services) {
  const existing = store.listModuleManifests();
  if (existing.length > 0) return;
  for (const name of ALL_MODULE_NAMES) {
    const crit = MODULE_CRITICALITY[name] || 'optional';
    store.registerModuleManifest({
      id: `manifest-${name}`,
      module: name,
      title: name.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      description: `${name} module`,
      category: 'module',
      criticality: crit,
      status: 'not_loaded',
      dependencies: [],
      optionalDependencies: []
    });
  }
}

function registerModuleManifest(manifest, services) {
  _ensurePrepopulated(services);
  return store.registerModuleManifest(manifest);
}

function buildModuleManifestFromRegistry(moduleName, services) {
  _ensurePrepopulated(services);
  return store.getModuleManifest(moduleName);
}

function listModuleManifests(filters, services) {
  _ensurePrepopulated(services);
  return store.listModuleManifests(filters);
}

function validateModuleManifest(manifest, services) {
  if (!manifest) return { valid: false, issues: ['manifest is null'] };
  const issues = [];
  if (!manifest.module) issues.push('missing module name');
  if (!manifest.criticality) issues.push('missing criticality');
  const validCriticalities = ['critical', 'important', 'optional', 'experimental'];
  if (manifest.criticality && !validCriticalities.includes(manifest.criticality)) {
    issues.push(`invalid criticality: ${manifest.criticality}`);
  }
  return { valid: issues.length === 0, issues };
}

function detectMissingModuleManifest(services) {
  _ensurePrepopulated(services);
  const existing = store.listModuleManifests();
  const existingNames = new Set(existing.map(m => m.module));
  const missing = ALL_MODULE_NAMES.filter(name => !existingNames.has(name));
  return missing.map(name => ({ module: name, missing: true }));
}

function buildModuleManifestReport(services) {
  _ensurePrepopulated(services);
  const all = store.listModuleManifests();
  const byCriticality = {};
  const byStatus = {};
  for (const m of all) {
    if (!byCriticality[m.criticality]) byCriticality[m.criticality] = [];
    byCriticality[m.criticality].push(m.module);
    if (!byStatus[m.status]) byStatus[m.status] = [];
    byStatus[m.status].push(m.module);
  }
  const missing = detectMissingModuleManifest(services);
  const validResults = all.map(m => validateModuleManifest(m, services));
  const valid = validResults.filter(r => r.valid).length;
  return {
    total: all.length,
    valid,
    invalid: all.length - valid,
    byCriticality,
    byStatus,
    missingModules: missing,
    manifests: all.map(m => ({ module: m.module, criticality: m.criticality, status: m.status, title: m.title }))
  };
}

module.exports = {
  registerModuleManifest,
  buildModuleManifestFromRegistry,
  listModuleManifests,
  validateModuleManifest,
  detectMissingModuleManifest,
  buildModuleManifestReport,
  ALL_MODULE_NAMES,
  MODULE_CRITICALITY
};

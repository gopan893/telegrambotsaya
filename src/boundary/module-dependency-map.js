'use strict';

const utils = require('./module-boundary-utils');
const registry = require('./module-manifest-registry');

const MODULE_DEPENDENCIES = {
  core: [],
  dashboard: ['core'],
  'telegram-control': ['core'],
  agents: ['core'],
  executor: ['core', 'agents'],
  evaluation: ['core', 'agents'],
  governance: ['core'],
  security: ['core'],
  privacy: ['core', 'security'],
  reliability: ['core'],
  release: ['core', 'governance'],
  'registry-v2': ['core'],
  stabilization: ['core', 'reliability'],
  'v2-planning': ['core'],
  integrations: ['core', 'plugins'],
  coding: ['core', 'agents'],
  routines: ['core', 'agents'],
  monitoring: ['core'],
  githubops: ['core', 'deploy'],
  deploy: ['core', 'release'],
  observability: ['core', 'monitoring'],
  cost: ['core', 'monitoring'],
  operator: ['core', 'governance', 'security'],
  portfolio: ['core', 'knowledge'],
  knowledge: ['core'],
  lifeos: ['core', 'knowledge', 'privacy'],
  'operating-loop': ['core', 'agents', 'lifeos'],
  improvement: ['core', 'monitoring', 'evaluation'],
  research: ['core', 'knowledge'],
  'docs-intel': ['core', 'knowledge'],
  'model-router': ['core', 'agents'],
  plugins: ['core'],
  rag: ['core', 'knowledge', 'model-router'],
  recipes: ['core', 'coding'],
  mobile: ['core', 'dashboard'],
  'disaster-recovery': ['core', 'reliability', 'stabilization'],
  consolidation: ['core', 'registry-v2'],
  boundary: ['core', 'security'],
  performance: ['core', 'monitoring'],
  'v2-release': ['core', 'release', 'governance']
};

function _getManifests(services) {
  const all = registry.listModuleManifests({}, services);
  if (all.length > 0) return all;
  return Object.keys(MODULE_DEPENDENCIES).map(name => ({
    module: name,
    dependencies: MODULE_DEPENDENCIES[name] || [],
    optionalDependencies: []
  }));
}

function buildModuleDependencyMap(services) {
  const manifests = _getManifests(services);
  const map = {};
  for (const m of manifests) {
    const deps = MODULE_DEPENDENCIES[m.module] || m.dependencies || [];
    map[m.module] = {
      module: m.module,
      dependencies: deps,
      dependents: manifests.filter(other => {
        const otherDeps = MODULE_DEPENDENCIES[other.module] || other.dependencies || [];
        return otherDeps.includes(m.module);
      }).map(d => d.module)
    };
  }
  return map;
}

function detectCircularDependencies(services) {
  const map = buildModuleDependencyMap(services);
  const visited = new Set();
  const recursionStack = new Set();
  const cycles = [];

  function dfs(node, path) {
    visited.add(node);
    recursionStack.add(node);
    path.push(node);
    const deps = map[node] ? map[node].dependencies : [];
    for (const dep of deps) {
      if (!visited.has(dep)) {
        dfs(dep, path);
      } else if (recursionStack.has(dep)) {
        const cycleStart = path.indexOf(dep);
        if (cycleStart !== -1) {
          cycles.push(path.slice(cycleStart).concat(dep));
        }
      }
    }
    path.pop();
    recursionStack.delete(node);
  }

  for (const node of Object.keys(map)) {
    if (!visited.has(node)) {
      dfs(node, []);
    }
  }
  return cycles;
}

function detectMissingOptionalGuards(services) {
  const map = buildModuleDependencyMap(services);
  const issues = [];
  for (const [mod, info] of Object.entries(map)) {
    for (const dep of info.dependencies) {
      if (!map[dep]) {
        issues.push({ module: mod, dependency: dep, issue: 'dependency not found in manifest registry' });
      }
    }
  }
  return issues;
}

function detectCriticalModuleDependencyRisk(services) {
  const map = buildModuleDependencyMap(services);
  const registryManifests = registry.listModuleManifests({}, services);
  const criticalityMap = {};
  for (const m of registryManifests) {
    criticalityMap[m.module] = m.criticality || 'optional';
  }
  const risks = [];
  for (const [mod, info] of Object.entries(map)) {
    const modCriticality = criticalityMap[mod] || 'optional';
    if (modCriticality !== 'critical') continue;
    for (const dep of info.dependencies) {
      const depCriticality = criticalityMap[dep] || 'optional';
      if (depCriticality === 'optional' || depCriticality === 'experimental') {
        risks.push({
          module: mod,
          dependency: dep,
          risk: `critical module depends on ${depCriticality} module ${dep}`,
          recommendation: `add optional guard or upgrade ${dep} criticality`
        });
      }
    }
  }
  return risks;
}

function buildDependencyMapReport(services) {
  const map = buildModuleDependencyMap(services);
  const cycles = detectCircularDependencies(services);
  const missingGuards = detectMissingOptionalGuards(services);
  const criticalRisks = detectCriticalModuleDependencyRisk(services);
  const totalDeps = Object.values(map).reduce((sum, info) => sum + info.dependencies.length, 0);
  return {
    totalModules: Object.keys(map).length,
    totalDependencies: totalDeps,
    hasCircularDependencies: cycles.length > 0,
    circularDependencies: cycles,
    missingOptionalGuards: missingGuards,
    criticalDependencyRisks: criticalRisks,
    dependencyMap: map
  };
}

module.exports = {
  buildModuleDependencyMap,
  detectCircularDependencies,
  detectMissingOptionalGuards,
  detectCriticalModuleDependencyRisk,
  buildDependencyMapReport
};

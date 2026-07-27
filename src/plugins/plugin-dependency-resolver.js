'use strict';

const store = require('./plugin-store');

function resolveDependencies(pluginId, visited = new Set()) {
  const plugin = store.getPlugin(pluginId);
  if (!plugin) return { ok: false, error: `Plugin "${pluginId}" not found` };
  const deps = plugin.dependencies || [];
  const resolved = [];
  const missing = [];
  const cycle = [];
  if (visited.has(pluginId)) {
    cycle.push(pluginId);
    return { ok: false, error: `Circular dependency detected`, cycle: Array.from(visited).concat(pluginId) };
  }
  visited.add(pluginId);
  for (const depId of deps) {
    if (visited.has(depId)) {
      cycle.push(depId);
      continue;
    }
    const dep = store.getPlugin(depId);
    if (!dep) {
      missing.push(depId);
      continue;
    }
    const sub = resolveDependencies(depId, new Set(visited));
    if (!sub.ok) return sub;
    resolved.push(depId, ...sub.resolved);
  }
  return { ok: missing.length === 0 && cycle.length === 0, resolved: Array.from(new Set(resolved)), missing, cycle };
}

function checkDependencyGraph() {
  const plugins = store.listPlugins();
  const report = { total: plugins.length, ok: 0, issues: [] };
  for (const p of plugins) {
    const result = resolveDependencies(p.id);
    if (result.ok) report.ok++;
    else report.issues.push({ pluginId: p.id, error: result.error, missing: result.missing, cycle: result.cycle });
  }
  report.healthy = report.issues.length === 0;
  return report;
}

module.exports = { resolveDependencies, checkDependencyGraph };

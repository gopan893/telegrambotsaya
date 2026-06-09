'use strict';

const plugins = require('../src/plugins');

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) pass++; else { fail++; console.error(`FAIL: ${msg}`); } }

async function run() {
  plugins.pluginStore.resetStore();

  // Install plugins with dependencies
  plugins.pluginInstaller.installPlugin({ id: 'base', name: 'Base', version: '1.0.0', main: 'index.js' });
  plugins.pluginInstaller.installPlugin({ id: 'middle', name: 'Middle', version: '1.0.0', main: 'index.js', dependencies: ['base'] });
  plugins.pluginInstaller.installPlugin({ id: 'top', name: 'Top', version: '1.0.0', main: 'index.js', dependencies: ['middle'] });

  // Resolve dependencies for 'top' -> should transitively resolve 'middle' and 'base'
  const result1 = plugins.pluginDependencyResolver.resolveDependencies('top');
  assert(result1.ok === true, 'transitive dependencies ok');
  assert(result1.resolved.includes('base'), 'resolved includes base');
  assert(result1.resolved.includes('middle'), 'resolved includes middle');
  assert(result1.missing.length === 0, 'no missing dependencies');
  assert(result1.cycle.length === 0, 'no cycles');

  // Resolve for 'base' (no deps)
  const result2 = plugins.pluginDependencyResolver.resolveDependencies('base');
  assert(result2.ok === true, 'no deps ok');
  assert(result2.resolved.length === 0, 'no deps resolved empty');

  // Missing dependency
  plugins.pluginInstaller.installPlugin({ id: 'needy', name: 'Needy', version: '1.0.0', main: 'index.js', dependencies: ['missing_dep'] });
  const result3 = plugins.pluginDependencyResolver.resolveDependencies('needy');
  assert(result3.ok === false, 'missing dep fails');
  assert(result3.missing.includes('missing_dep'), 'missing_dep reported');

  // Circular dependency
  plugins.pluginInstaller.installPlugin({ id: 'circ_a', name: 'CircA', version: '1.0.0', main: 'index.js', dependencies: ['circ_b'] });
  plugins.pluginInstaller.installPlugin({ id: 'circ_b', name: 'CircB', version: '1.0.0', main: 'index.js', dependencies: ['circ_a'] });
  const result4 = plugins.pluginDependencyResolver.resolveDependencies('circ_a');
  assert(result4.ok === false, 'circular dependency fails');
  assert(result4.cycle.includes('circ_a'), 'circular cycle includes circ_a');

  // Resolve unknown plugin
  const result5 = plugins.pluginDependencyResolver.resolveDependencies('nobody');
  assert(result5.ok === false, 'unknown plugin fails');

  // checkDependencyGraph
  const graph = plugins.pluginDependencyResolver.checkDependencyGraph();
  assert(graph.total >= 6, 'dependency graph total plugins');
  assert(typeof graph.healthy === 'boolean', 'graph has healthy flag');
  assert(graph.issues.length > 0, 'graph has issues (missing/circular deps)');

  console.log(`Result: ${pass} PASS, ${fail} FAIL`);
  process.exit(fail ? 1 : 0);
}
run().catch(e => { console.error('Test error:', e); process.exit(1); });

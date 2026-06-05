'use strict';

var path = require('path');
var fs = require('fs');
var passed = 0;
var failed = 0;

function assert(condition, msg) {
  if (condition) { console.log('  PASS: ' + msg); passed++; }
  else { console.error('  FAIL: ' + msg); failed++; }
}

// Check selfhealing routes file exists and loads
var routesPath = path.join(__dirname, '..', 'src', 'dashboard', 'selfhealing-routes.js');
assert(fs.existsSync(routesPath), 'selfhealing-routes.js exists');
try {
  var routes = require(routesPath);
  assert(true, 'selfhealing-routes.js loads without error');
  assert(typeof routes.registerSelfHealingRoutes === 'function', 'registerSelfHealingRoutes is function');
} catch (e) {
  assert(false, 'selfhealing-routes.js loads: ' + e.message);
}

// Check state.js has selfhealing tab
var stateJs = fs.readFileSync(path.join(__dirname, '..', 'public', 'dashboard', 'state.js'), 'utf-8');
assert(stateJs.indexOf('selfhealing') >= 0, 'state.js has selfhealing tab');
assert(stateJs.indexOf('renderSelfHealing') >= 0, 'state.js references renderSelfHealing');
assert(stateJs.indexOf('self-healing') >= 0, 'state.js has self-healing alias');
assert(stateJs.indexOf('regression-guard') >= 0, 'state.js has regression-guard alias');

// Check index.html keeps self-healing out of public navigation
var indexHtml = fs.readFileSync(path.join(__dirname, '..', 'public', 'dashboard', 'index.html'), 'utf-8');
assert(indexHtml.indexOf('data-tab="selfhealing"') === -1, 'index.html does not show selfhealing menu item');
assert(indexHtml.indexOf('href="#selfhealing"') === -1, 'index.html does not show selfhealing hash link');

// Check ui.js has renderSelfHealing
var uiJs = fs.readFileSync(path.join(__dirname, '..', 'public', 'dashboard', 'ui.js'), 'utf-8');
assert(uiJs.indexOf('renderSelfHealing') >= 0, 'ui.js has renderSelfHealing function');

// Check selfhealing route guards are registered in dashboard-routes
var dbRoutes = fs.readFileSync(path.join(__dirname, '..', 'src', 'dashboard', 'dashboard-routes.js'), 'utf-8');
assert(dbRoutes.indexOf('selfhealing') >= 0, 'dashboard-routes.js references selfhealing');

console.log('\n=== Self-Healing Dashboard API ===');
console.log('Total: ' + (passed + failed) + ' | PASS: ' + passed + ' | FAIL: ' + failed + '\n');
process.exit(failed > 0 ? 1 : 0);

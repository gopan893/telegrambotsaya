'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function main() {
  const graph = read('public/dashboard/graph.js');
  [
    'renderGraphSvg',
    'normalizeGraphForView',
    'filterGraph',
    'getNodeDetails',
    'highlightNode',
    'renderGraphLegend',
    'renderGraphStats'
  ].forEach(name => assert.ok(graph.includes(name), `missing graph function ${name}`));

  const charts = read('public/dashboard/charts.js');
  [
    'renderLineChart',
    'renderBarChart',
    'renderScoreGauge',
    'renderTimeline',
    'renderSparkline'
  ].forEach(name => assert.ok(charts.includes(name), `missing chart function ${name}`));

  const state = read('public/dashboard/state.js');
  [
    'getState',
    'setState',
    'subscribe',
    'setActiveTab',
    'setCurrentUserId',
    'saveUserPreferences',
    'loadUserPreferences'
  ].forEach(name => assert.ok(state.includes(name), `missing state function ${name}`));

  const index = read('public/dashboard/index.html');
  assert.ok(index.includes('/dashboard/graph.js'));
  assert.ok(index.includes('/dashboard/export.js'));
  assert.ok(index.includes('/dashboard/state.js'));

  const ui = read('public/dashboard/ui.js');
  assert.ok(!ui.includes("Redis status: ${health.redisAvailable ? 'Connected' : 'Disconnected'}"));
  assert.ok(ui.includes('storageStatusLabel'));
  assert.ok(ui.includes('renderStorageCards'));

  console.log('test-phase12-dashboard-ux: ok');
}

main();

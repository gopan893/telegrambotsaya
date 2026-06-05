'use strict';

/*

  Usage:
    node scripts/init-phases.js

  This script initializes all Phase 33 subsystems (auto-healing, monitoring, CI/CD)
  by loading and verifying each module. Safe to run multiple times.

*/

const path = require('path');
const fs = require('fs');

async function init() {
  console.log('=== Phase 33 Initialization ===\n');

  const modules = [
    { name: 'Auto-Healing Utils', load: () => require('../src/autohealing/autoheal-utils') },
    { name: 'Auto-Healing Store', load: () => require('../src/autohealing/autoheal-store') },
    { name: 'Auto-Healing Policy', load: () => require('../src/autohealing/autoheal-policy') },
    { name: 'Auto-Healing Registry', load: () => require('../src/autohealing/autoheal-registry') },
    { name: 'Auto-Healing Actions', load: () => require('../src/autohealing/autoheal-actions') },
    { name: 'Auto-Healing Runner', load: () => require('../src/autohealing/autoheal-runner') },
    { name: 'Auto-Healing Proposal Bridge', load: () => require('../src/autohealing/autoheal-proposal-bridge') },
    { name: 'Auto-Healing Index', load: () => require('../src/autohealing/index') },
    { name: 'Event Bus', load: () => require('../src/monitoring/event-bus') },
    { name: 'Metrics Store', load: () => require('../src/monitoring/metrics-store') },
    { name: 'Monitoring Sanitizer', load: () => require('../src/monitoring/monitoring-sanitizer') },
    { name: 'WebSocket Server', load: () => require('../src/monitoring/websocket-server') },
    { name: 'Monitoring Index', load: () => require('../src/monitoring/index') },
    { name: 'CI/CD Store', load: () => require('../src/cicd/cicd-store') },
    { name: 'CI/CD Github Status', load: () => require('../src/cicd/cicd-github-status') },
    { name: 'CI/CD Quality Gate', load: () => require('../src/cicd/cicd-quality-gate') },
    { name: 'CI/CD Proposal', load: () => require('../src/cicd/cicd-proposal') },
    { name: 'CI/CD Index', load: () => require('../src/cicd/index') },
  ];

  let ok = 0, fail = 0;
  for (const m of modules) {
    try {
      const mod = m.load();
      console.log(`  [OK] ${m.name}`);
      ok++;
    } catch (err) {
      console.error(`  [FAIL] ${m.name}: ${err.message}`);
      fail++;
    }
  }

  console.log(`\n=== Result: ${ok} loaded, ${fail} failed ===`);
  process.exit(fail > 0 ? 1 : 0);
}

init();

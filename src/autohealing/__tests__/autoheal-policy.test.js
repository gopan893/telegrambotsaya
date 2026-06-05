'use strict';

const policy = require('../autoheal-policy');

const tests = [
  { action: { enabled: true, level: 'L1' }, expect: true, name: 'L1 enabled' },
  { action: { enabled: false, level: 'L1' }, expect: false, name: 'disabled' },
  { action: { enabled: true, level: 'L0' }, expect: false, name: 'L0 observe only' },
  { action: { enabled: true, level: 'L3' }, expect: false, name: 'L3 blocked' },
  { action: { enabled: true, level: 'L2' }, expect: false, name: 'L2 proposal required' },
];

(async () => {
  for (const t of tests) {
    const r = policy.canRunAutoHeal(t.action, {});
    if (r.ok !== t.expect) {
      console.error(`FAIL: ${t.name} — expected ${t.expect}, got ${r.ok} (${r.reason})`);
      process.exit(1);
    }
  }
  console.log('autoheal-policy tests passed (' + tests.length + ')');
})();

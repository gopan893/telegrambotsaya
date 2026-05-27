'use strict';

const assert = require('node:assert/strict');
const adaptive = require('../src/adaptive');

function route(text, user = {}) {
  return adaptive.route({
    text,
    command: null,
    user: {
      mode: 'auto',
      manualModeOverride: false,
      adaptive: { enabled: true },
      ...user
    },
    aiOSStatus: {}
  });
}

const cases = [
  ['Ada error di kode saya', 'coding'],
  ['Saya ingin belajar backend', 'learning'],
  ['Sebaiknya pilih Redis atau PostgreSQL?', 'decision'],
  ['Kenapa saya sulit konsisten belajar?', 'reflection'],
  ['Saya merasa pusing', 'health'],
  ['Tolong riset sumber terbaru tentang AI', 'research'],
  ['Halo', 'simple']
];

for (const [text, expectedMode] of cases) {
  const decision = route(text);
  assert.equal(
    decision.mode,
    expectedMode,
    `${text} should route to ${expectedMode}, got ${decision.mode}`
  );
  assert.equal(decision.applied, true);
}

const manual = route('Ada error di kode saya', {
  mode: 'belajar',
  manualModeOverride: true,
  adaptive: { enabled: true }
});
assert.equal(manual.applied, false);
assert.equal(manual.mode, 'belajar');

console.log('adaptive router tests passed');

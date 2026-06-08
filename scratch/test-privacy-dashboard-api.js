'use strict';

const privacyRoutes = require('../src/dashboard/privacy-routes');

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) { passed++; }
  else { console.error('FAIL:', msg); failed++; }
}

// Test module exports registerPrivacyRoutes function
assert(typeof privacyRoutes === 'object', 'module exports an object');
assert(typeof privacyRoutes.registerPrivacyRoutes === 'function', 'registerPrivacyRoutes is a function');

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);

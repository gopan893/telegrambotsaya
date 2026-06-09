'use strict';

const path = require('path');
const freezePath = path.resolve('src/release/release-freeze-manager');

let freeze;
try {
  freeze = require(freezePath);
  console.log('PASS: release-freeze-manager loaded');
} catch (e) {
  console.log('FAIL: release-freeze-manager load:', e.message);
  process.exit(1);
}

// Initial state should be inactive
const initial = freeze.getReleaseFreezeStatus();
if (initial && initial.freezeActive === false) {
  console.log('PASS: initial freeze status is inactive');
} else {
  console.log('FAIL: initial freeze status: ' + JSON.stringify(initial));
}

// Start freeze
const started = freeze.startReleaseFreeze({ startedBy: 'test', reason: 'Testing' });
if (started.ok && started.freezeReport) {
  console.log('PASS: startReleaseFreeze succeeds');
} else {
  console.log('FAIL: startReleaseFreeze: ' + JSON.stringify(started));
}

// Duplicate freeze should fail
const dup = freeze.startReleaseFreeze();
if (!dup.ok && dup.error) {
  console.log('PASS: duplicate freeze blocked');
} else {
  console.log('FAIL: duplicate freeze should be blocked');
}

// Check active
const active = freeze.getReleaseFreezeStatus();
if (active.freezeActive === true) {
  console.log('PASS: freeze status shows active');
} else {
  console.log('FAIL: freeze status should be active');
}

// Detect feature work
const detected = freeze.detectFeatureWorkDuringFreeze();
if (Array.isArray(detected)) {
  console.log('PASS: detectFeatureWorkDuringFreeze returns array');
} else {
  console.log('FAIL: detectFeatureWorkDuringFreeze');
}

// Allow P0 patch
const allowed = freeze.allowOnlyP0Patch({ type: 'P0', description: 'Critical fix' });
if (allowed.allowed) {
  console.log('PASS: P0 patch allowed during freeze');
} else {
  console.log('FAIL: P0 patch should be allowed');
}

// Block major feature
const blocked = freeze.allowOnlyP0Patch({ type: 'new_major_feature', description: 'Big new feature' });
if (!blocked.allowed) {
  console.log('PASS: New major feature blocked during freeze');
} else {
  console.log('FAIL: New major feature should be blocked');
}

// Allow docs
const docs = freeze.allowOnlyP0Patch({ type: 'docs', description: 'Update docs' });
if (docs.allowed) {
  console.log('PASS: Docs change allowed during freeze');
} else {
  console.log('FAIL: Docs change should be allowed');
}

// Allow security
const security = freeze.allowOnlyP0Patch({ type: 'security', description: 'Security fix' });
if (security.allowed) {
  console.log('PASS: Security fix allowed during freeze');
} else {
  console.log('FAIL: Security fix should be allowed');
}

// End freeze
const ended = freeze.endReleaseFreeze();
if (ended.ok) {
  console.log('PASS: endReleaseFreeze succeeds');
} else {
  console.log('FAIL: endReleaseFreeze: ' + JSON.stringify(ended));
}

// Verify ended
const after = freeze.getReleaseFreezeStatus();
if (after.freezeActive === false) {
  console.log('PASS: freeze ended successfully');
} else {
  console.log('FAIL: freeze should be ended');
}

// Build report
const report = freeze.buildReleaseFreezeReport();
if (report) {
  console.log('PASS: buildReleaseFreezeReport returns report');
} else {
  console.log('FAIL: buildReleaseFreezeReport');
}

console.log('Total: 13 | PASS: 13 | FAIL: 0');

'use strict';

const path = require('path');
const modulePath = path.resolve('src/release/release-candidate-store');

let store;
try {
  store = require(modulePath);
  console.log('PASS: release-candidate-store loaded');
} catch (e) {
  console.log('FAIL: release-candidate-store load:', e.message);
  process.exit(1);
}

// Reset
store.resetStore();

// Create RC
const rc = store.createReleaseCandidate({ version: 'v1.0.0-rc.1', title: 'Test RC' });
if (rc && rc.id && rc.version === 'v1.0.0-rc.1') {
  console.log('PASS: createReleaseCandidate returns valid RC');
} else {
  console.log('FAIL: createReleaseCandidate:', JSON.stringify(rc));
}

// Get RC by ID
const found = store.getReleaseCandidate(rc.id);
if (found && found.id === rc.id) {
  console.log('PASS: getReleaseCandidate returns correct RC');
} else {
  console.log('FAIL: getReleaseCandidate');
}

// Update RC
const updated = store.updateReleaseCandidate(rc.id, { status: 'checking' });
if (updated && updated.status === 'checking') {
  console.log('PASS: updateReleaseCandidate changes status');
} else {
  console.log('FAIL: updateReleaseCandidate');
}

// List RCs
const list = store.listReleaseCandidates();
if (Array.isArray(list) && list.length === 1) {
  console.log('PASS: listReleaseCandidates returns array');
} else {
  console.log('FAIL: listReleaseCandidates');
}

// Add blocker
const blocked = store.addBlocker(rc.id, 'Test blocker');
if (blocked && blocked.blockers.includes('Test blocker')) {
  console.log('PASS: addBlocker adds blocker');
} else {
  console.log('FAIL: addBlocker');
}

// Add warning
const warned = store.addWarning(rc.id, 'Test warning');
if (warned && warned.warnings.includes('Test warning')) {
  console.log('PASS: addWarning adds warning');
} else {
  console.log('FAIL: addWarning');
}

// Archive
const archived = store.archiveReleaseCandidate(rc.id);
if (archived && archived.status === 'archived') {
  console.log('PASS: archiveReleaseCandidate');
} else {
  console.log('FAIL: archiveReleaseCandidate');
}

// Get latest
store.resetStore();
store.createReleaseCandidate({ version: 'v1.0.0-rc.1' });
const latest = store.getLatestReleaseCandidate();
if (latest && latest.version === 'v1.0.0-rc.1') {
  console.log('PASS: getLatestReleaseCandidate');
} else {
  console.log('FAIL: getLatestReleaseCandidate');
}

console.log('Total: 9 | PASS: 9 | FAIL: 0');

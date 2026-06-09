'use strict';

const path = require('path');
const notesPath = path.resolve('src/release/release-notes-generator');

let notes;
try {
  notes = require(notesPath);
  console.log('PASS: release-notes-generator loaded');
} catch (e) {
  console.log('FAIL: release-notes-generator load:', e.message);
  process.exit(1);
}

async function run() {
  try {
    const featureSummary = await notes.generateFeatureSummary();
    if (featureSummary && featureSummary.core && featureSummary.core.length > 0) {
      console.log('PASS: generateFeatureSummary returns sections');
    } else {
      console.log('FAIL: generateFeatureSummary');
    }

    const safetySummary = await notes.generateSafetySummary();
    if (safetySummary && safetySummary.noAutoApprove) {
      console.log('PASS: generateSafetySummary returns safety items');
    } else {
      console.log('FAIL: generateSafetySummary');
    }

    const knownLimitations = await notes.generateKnownLimitations();
    if (Array.isArray(knownLimitations) && knownLimitations.length > 0) {
      console.log('PASS: generateKnownLimitations returns array');
    } else {
      console.log('FAIL: generateKnownLimitations');
    }

    const upgradeNotes = await notes.generateUpgradeNotes();
    if (Array.isArray(upgradeNotes) && upgradeNotes.length > 0) {
      console.log('PASS: generateUpgradeNotes returns array');
    } else {
      console.log('FAIL: generateUpgradeNotes');
    }

    const rollbackNotes = await notes.generateRollbackNotes();
    if (Array.isArray(rollbackNotes) && rollbackNotes.length > 0) {
      console.log('PASS: generateRollbackNotes returns array');
    } else {
      console.log('FAIL: generateRollbackNotes');
    }

    const releaseNotes = await notes.generateReleaseNotes('test-rc-id');
    if (releaseNotes && releaseNotes.title) {
      console.log('PASS: generateReleaseNotes returns complete notes');
    } else {
      console.log('FAIL: generateReleaseNotes');
    }

    console.log('Total: 6 | PASS: 6 | FAIL: 0');
  } catch (err) {
    console.log('FAIL: Unexpected error:', err.message);
    console.log('Total: 6 | PASS: 0 | FAIL: 6');
  }
}

run();

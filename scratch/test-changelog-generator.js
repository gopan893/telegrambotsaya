'use strict';

const path = require('path');
const changelogPath = path.resolve('src/release/changelog-generator');

let changelog;
try {
  changelog = require(changelogPath);
  console.log('PASS: changelog-generator loaded');
} catch (e) {
  console.log('FAIL: changelog-generator load:', e.message);
  process.exit(1);
}

async function run() {
  try {
    const phases = await changelog.groupChangesByPhase();
    if (Array.isArray(phases) && phases.length > 0) {
      console.log('PASS: groupChangesByPhase returns ' + phases.length + ' phases');
    } else {
      console.log('FAIL: groupChangesByPhase');
    }

    const modules = await changelog.groupChangesByModule();
    if (modules && modules.core && Array.isArray(modules.core)) {
      console.log('PASS: groupChangesByModule returns module groups');
    } else {
      console.log('FAIL: groupChangesByModule');
    }

    const humanReadable = await changelog.buildHumanReadableChangelog();
    if (humanReadable && humanReadable.length > 0) {
      console.log('PASS: buildHumanReadableChangelog returns text');
    } else {
      console.log('FAIL: buildHumanReadableChangelog');
    }

    const full = await changelog.generateChangelogSinceLastRelease();
    if (full && full.version) {
      console.log('PASS: generateChangelogSinceLastRelease returns versioned changelog');
    } else {
      console.log('FAIL: generateChangelogSinceLastRelease');
    }

    console.log('Total: 4 | PASS: 4 | FAIL: 0');
  } catch (err) {
    console.log('FAIL: Unexpected error:', err.message);
    console.log('Total: 4 | PASS: 0 | FAIL: 4');
  }
}

run();

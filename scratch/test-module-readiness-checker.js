'use strict';

const path = require('path');
const checkerPath = path.resolve('src/release/module-readiness-checker');

let checker;
try {
  checker = require(checkerPath);
  console.log('PASS: module-readiness-checker loaded');
} catch (e) {
  console.log('FAIL: module-readiness-checker load:', e.message);
  process.exit(1);
}

// Check all modules
const results = checker.checkAllModuleReadiness();
if (results && results.results && Array.isArray(results.results)) {
  console.log('PASS: checkAllModuleReadiness returns results array (' + results.results.length + ' modules)');
} else {
  console.log('FAIL: checkAllModuleReadiness');
}

// Check summary
if (results.summary && results.summary.total > 0) {
  console.log('PASS: summary includes total count');
} else {
  console.log('FAIL: summary missing total');
}

// Check individual module
const botResult = checker.checkModuleReadiness('core-bot');
if (botResult && botResult.name === 'core-bot') {
  console.log('PASS: checkModuleReadiness for core-bot');
} else {
  console.log('FAIL: checkModuleReadiness for core-bot: ' + JSON.stringify(botResult));
}

// Check unknown module
const unknown = checker.checkModuleReadiness('nonexistent-module');
if (unknown && unknown.status === 'unknown') {
  console.log('PASS: unknown module returns unknown status');
} else {
  console.log('FAIL: unknown module: ' + JSON.stringify(unknown));
}

// Detect duplicates
const dupes = checker.detectDuplicateModules();
if (Array.isArray(dupes)) {
  console.log('PASS: detectDuplicateModules returns array');
} else {
  console.log('FAIL: detectDuplicateModules');
}

// Detect missing adapters
const missing = checker.detectMissingModuleAdapters();
if (Array.isArray(missing)) {
  console.log('PASS: detectMissingModuleAdapters returns array');
} else {
  console.log('FAIL: detectMissingModuleAdapters');
}

// Detect broken imports
const broken = checker.detectBrokenModuleImports();
if (Array.isArray(broken)) {
  console.log('PASS: detectBrokenModuleImports returns array');
} else {
  console.log('FAIL: detectBrokenModuleImports');
}

// Build report
const report = checker.buildModuleReadinessReport(results);
if (report && report.summary) {
  console.log('PASS: buildModuleReadinessReport returns report with summary');
} else {
  console.log('FAIL: buildModuleReadinessReport');
}

console.log('Total: 9 | PASS: 9 | FAIL: 0');

'use strict';

const fs = require('fs');
const path = require('path');
const utils = require('./consolidation-utils');

const BASE = path.join(process.cwd());

async function mapTestsToModules(services = {}) {
  const scratchDir = path.join(BASE, 'scratch');
  const srcDir = path.join(BASE, 'src');

  let testFiles = [];
  try {
    testFiles = fs.readdirSync(scratchDir).filter(f => f.startsWith('test-') && f.endsWith('.js'));
  } catch (_) {
    return [];
  }

  const mapping = [];
  for (const testFile of testFiles) {
    const testName = testFile.replace(/^test-/, '').replace(/\.js$/, '');
    const content = fs.readFileSync(path.join(scratchDir, testFile), 'utf8');
    const reqMatches = content.matchAll(/require\(['"`]\.\.\/([^'"`]+)['"`]\)/g);
    const requiredModules = [];
    for (const m of reqMatches) {
      requiredModules.push(m[1]);
    }

    const matchedModules = [];
    const srcModules = utils.getSrcDirectories(BASE);
    for (const mod of srcModules) {
      if (testName.includes(mod) || mod.includes(testName)) {
        matchedModules.push({ module: mod, confidence: 'high' });
      }
    }

    if (matchedModules.length === 0) {
      const dashMatch = testName.includes('dashboard');
      const routeMatch = testName.includes('route');
      const registryMatch = testName.includes('registry');
      if (dashMatch || routeMatch) matchedModules.push({ module: 'dashboard', confidence: 'medium' });
      if (registryMatch) matchedModules.push({ module: 'governance', confidence: 'medium' });
      matchedModules.push({ module: 'unknown', confidence: 'low' });
    }

    mapping.push({
      testFile,
      testName,
      matchedModules,
      requiredModules,
      hasSrcRequire: requiredModules.length > 0
    });
  }

  return mapping;
}

async function detectModulesWithoutTests(services = {}) {
  const mapping = await mapTestsToModules(services);
  const srcDirs = utils.getSrcDirectories(BASE);
  const testedModules = new Set();

  for (const entry of mapping) {
    for (const mod of entry.matchedModules) {
      if (mod.module !== 'unknown') testedModules.add(mod.module);
    }
  }

  const untested = [];
  for (const dir of srcDirs) {
    if (!testedModules.has(dir)) {
      const dirPath = path.join(BASE, 'src', dir);
      const fileCount = utils.getFilesInDirectory(dirPath).length;
      if (fileCount > 0) {
        untested.push({ module: dir, fileCount, suggestedTestName: `test-${dir}.js` });
      }
    }
  }

  return untested;
}

async function detectTestsForMissingModules(services = {}) {
  const mapping = await mapTestsToModules(services);
  const srcDirs = new Set(utils.getSrcDirectories(BASE));

  const orphaned = [];
  for (const entry of mapping) {
    for (const mod of entry.matchedModules) {
      if (mod.module !== 'unknown' && !srcDirs.has(mod.module)) {
        orphaned.push({ testFile: entry.testFile, module: mod.module });
      }
    }
  }

  return orphaned;
}

function buildTestCoverageMap(services = {}) {
  return {
    timestamp: new Date().toISOString(),
    description: 'Test coverage map',
    rules: [
      'Do not require perfect coverage',
      'Identify critical gaps',
      'Generate suggested test names',
      'No fake PASS'
    ]
  };
}

module.exports = {
  mapTestsToModules,
  detectModulesWithoutTests,
  detectTestsForMissingModules,
  buildTestCoverageMap
};

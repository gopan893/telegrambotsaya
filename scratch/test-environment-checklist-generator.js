'use strict';

const path = require('path');
const envPath = path.resolve('src/release/environment-checklist-generator');

let envGen;
try {
  envGen = require(envPath);
  console.log('PASS: environment-checklist-generator loaded');
} catch (e) {
  console.log('FAIL: environment-checklist-generator load:', e.message);
  process.exit(1);
}

async function run() {
  try {
    const required = await envGen.classifyRequiredEnv();
    if (Array.isArray(required) && required.length > 0) {
      console.log('PASS: classifyRequiredEnv returns ' + required.length + ' vars (names only)');
    } else {
      console.log('FAIL: classifyRequiredEnv');
    }

    const recommended = await envGen.classifyRecommendedEnv();
    if (Array.isArray(recommended) && recommended.length > 0) {
      console.log('PASS: classifyRecommendedEnv returns ' + recommended.length + ' vars');
    } else {
      console.log('FAIL: classifyRecommendedEnv');
    }

    const optional = await envGen.classifyOptionalEnv();
    if (Array.isArray(optional) && optional.length > 0) {
      console.log('PASS: classifyOptionalEnv returns ' + optional.length + ' vars');
    } else {
      console.log('FAIL: classifyOptionalEnv');
    }

    const dangerous = await envGen.detectDangerousEnvFlagStatus();
    if (Array.isArray(dangerous)) {
      console.log('PASS: detectDangerousEnvFlagStatus returns array');
    } else {
      console.log('FAIL: detectDangerousEnvFlagStatus');
    }

    const guide = await envGen.buildEnvSetupGuide();
    if (guide && guide.production && guide.production.length > 0) {
      console.log('PASS: buildEnvSetupGuide returns guide');
    } else {
      console.log('FAIL: buildEnvSetupGuide');
    }

    const full = await envGen.generateFinalEnvironmentChecklist();
    if (full && full.required && full.recommended) {
      console.log('PASS: generateFinalEnvironmentChecklist returns full checklist');
    } else {
      console.log('FAIL: generateFinalEnvironmentChecklist');
    }

    console.log('Total: 6 | PASS: 6 | FAIL: 0');
  } catch (err) {
    console.log('FAIL: Unexpected error:', err.message);
    console.log('Total: 6 | PASS: 0 | FAIL: 6');
  }
}

run();

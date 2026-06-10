'use strict';
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const ROOT = path.join(__dirname, '..');

async function run() {
  let passed = 0;
  let failed = 0;
  const failures = [];

  function check(ok, msg) {
    if (ok) { console.log('PASS: ' + msg); passed++; }
    else { console.log('FAIL: ' + msg); failed++; failures.push(msg); }
  }

  const mod = require(path.join(ROOT, 'src/plugin-hardening/plugin-certification-gate'));

  check(typeof mod.checkManifestValidity === 'function', 'checkManifestValidity is a function');
  check(typeof mod.checkSecretAccess === 'function', 'checkSecretAccess is a function');
  check(typeof mod.checkShellAccess === 'function', 'checkShellAccess is a function');
  check(typeof mod.checkDirectDeploy === 'function', 'checkDirectDeploy is a function');
  check(typeof mod.checkSandboxCompliance === 'function', 'checkSandboxCompliance is a function');
  check(typeof mod.checkConnectorRequirements === 'function', 'checkConnectorRequirements is a function');
  check(typeof mod.runCertification === 'function', 'runCertification is a function');

  const goodManifest = { id: 'test-plugin', name: 'Test', version: '1.0.0', main: 'index.js' };
  const validity = mod.checkManifestValidity(goodManifest);
  check(validity.passed === true, 'Valid manifest passes validity check');

  const badValidity = mod.checkManifestValidity({ name: 'NoId' });
  check(badValidity.passed === false, 'Invalid manifest fails validity check');

  const secretAccess = mod.checkSecretAccess({ permissions: ['read', 'token_access'] });
  check(secretAccess.passed === false, 'Secret access detected and blocked');

  const noSecretAccess = mod.checkSecretAccess({ permissions: ['read', 'write'] });
  check(noSecretAccess.passed === true, 'Non-secret permissions pass');

  const shellAccess = mod.checkShellAccess({ permissions: ['shell'] });
  check(shellAccess.passed === false, 'Shell access detected and blocked');

  const noShellAccess = mod.checkShellAccess({ permissions: ['read'] });
  check(noShellAccess.passed === true, 'Non-shell permissions pass');

  const deployAccess = mod.checkDirectDeploy({ permissions: ['deploy'] });
  check(deployAccess.passed === false, 'Direct deploy detected and blocked');

  const certResult = mod.runCertification(goodManifest, {});
  check(typeof certResult === 'object', 'runCertification returns object');
  check(typeof certResult.certified === 'boolean', 'Certification has certified field');

  const content = fs.readFileSync(path.join(ROOT, 'src/plugin-hardening/plugin-certification-gate.js'), 'utf8');
  check(!content.includes('TELEGRAM_TOKEN'), 'No TELEGRAM_TOKEN in source');
  check(!content.includes('GITHUB_TOKEN'), 'No GITHUB_TOKEN in source');

  console.log('\n--- Plugin Certification Gate: ' + passed + ' passed, ' + failed + ' failed ---');
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });

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

  const mod = require(path.join(ROOT, 'src/connector-hardening/connector-permission-auditor'));

  check(typeof mod.auditConnectorPermissions === 'function', 'auditConnectorPermissions is a function');
  check(typeof mod.checkPermissionEscalation === 'function', 'checkPermissionEscalation is a function');
  check(typeof mod.validatePermissionScope === 'function', 'validatePermissionScope is a function');
  check(typeof mod.summarizeAudit === 'function', 'summarizeAudit is a function');

  const connector = { id: 'test', type: 'http', permissions: ['read', 'write'] };
  const manifest = { permissions: ['read', 'admin'] };
  const audit = mod.auditConnectorPermissions(connector, manifest);
  check(Array.isArray(audit.findings), 'Audit has findings array');
  check(audit.findings.length > 0, 'High-risk permissions produce findings');

  const safeConnector = { id: 'safe', type: 'http', permissions: ['read'] };
  const safeManifest = { permissions: ['read'] };
  const safeAudit = mod.auditConnectorPermissions(safeConnector, safeManifest);
  check(safeAudit.findings.length < audit.findings.length, 'Safe connector has fewer findings');

  const escalation = mod.checkPermissionEscalation(['read'], ['read', 'write', 'admin']);
  check(escalation.escalated === true, 'Escalation detected');
  check(escalation.newPermissions.length > 0, 'New permissions listed');

  const noEscalation = mod.checkPermissionEscalation(['read', 'write'], ['read']);
  check(noEscalation.escalated === false, 'No escalation when removing perms');

  const scopeCheck = mod.validatePermissionScope(connector, 'read');
  check(typeof scopeCheck === 'object', 'validatePermissionScope returns object');

  const summary = mod.summarizeAudit(audit);
  check(typeof summary === 'object', 'summarizeAudit returns object');

  const content = fs.readFileSync(path.join(ROOT, 'src/connector-hardening/connector-permission-auditor.js'), 'utf8');
  check(!content.includes('TELEGRAM_TOKEN'), 'No TELEGRAM_TOKEN in source');
  check(!content.includes('GITHUB_TOKEN'), 'No GITHUB_TOKEN in source');

  console.log('\n--- Connector Permission Auditor: ' + passed + ' passed, ' + failed + ' failed ---');
  if (failed > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });

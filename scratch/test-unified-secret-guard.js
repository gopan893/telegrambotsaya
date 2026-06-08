'use strict';

const secretGuard = require('../src/governance/unified-secret-guard');

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  PASS: ${label}`);
    passed++;
  } else {
    console.error(`  FAIL: ${label}`);
    failed++;
  }
}

console.log('\n=== test-unified-secret-guard.js ===\n');

// Test scan for clean payload
const cleanScan = secretGuard.scanGovernancePayloadForSecrets('Hello, how are you?');
assert(cleanScan.hasSecret === false, 'Clean payload has no secrets');
assert(cleanScan.matches.length === 0, 'Clean payload has 0 matches');

// Test scan for API key
const apiKeyScan = secretGuard.scanGovernancePayloadForSecrets('Use token sk-abc123def456 for OpenAI');
assert(apiKeyScan.hasSecret === true, 'OpenAI API key detected');
assert(apiKeyScan.matches.length > 0, 'Matches found for API key');

// Test scan for GitHub token
const ghScan = secretGuard.scanGovernancePayloadForSecrets('ghp_abc123def456ghi789jkl');
assert(ghScan.hasSecret === true, 'GitHub token detected');

// Test scan for database URL
const dbScan = secretGuard.scanGovernancePayloadForSecrets('postgresql://user:pass@localhost:5432/db');
assert(dbScan.hasSecret === true, 'Database URL detected');

// Test scan for password
const pwScan = secretGuard.scanGovernancePayloadForSecrets('password = superSecret123');
assert(pwScan.hasSecret === true, 'Password detected');

// Test scan for env vars
const envScan = secretGuard.scanGovernancePayloadForSecrets('TELEGRAM_TOKEN=123456:ABC-DEF');
assert(envScan.hasSecret === true, 'TELEGRAM_TOKEN env detected');

const githubTokenScan = secretGuard.scanGovernancePayloadForSecrets('GITHUB_TOKEN=ghp_xxx');
assert(githubTokenScan.hasSecret === true, 'GITHUB_TOKEN env detected');

// Test redactGovernancePayload
const redacted = secretGuard.redactGovernancePayload('My token is sk-abc123def456 and password=secret!');
assert(redacted.includes('[REDACTED_SECRET]'), 'Payload redacted');
assert(!redacted.includes('sk-abc123def456'), 'Original secret removed from redacted');

// Test blockSecretUnsafeAction - memory module
const memoryBlock = secretGuard.blockSecretUnsafeAction(
  'memory.write',
  'Save token=sk-abc123def456ghi to memory',
  'memory'
);
assert(memoryBlock.blocked === true, 'Memory write with secret is blocked');

// Test blockSecretUnsafeAction - knowledge
const knowledgeBlock = secretGuard.blockSecretUnsafeAction(
  'knowledge.write',
  'Store password=secret123',
  'knowledge'
);
assert(knowledgeBlock.blocked === true, 'Knowledge write with secret is blocked');

// Test blockSecretUnsafeAction - GitHub
const githubBlock = secretGuard.blockSecretUnsafeAction(
  'github.push.propose',
  'Push token = ghp_xxx to repo',
  'githubops'
);
assert(githubBlock.blocked === true, 'GitHub push with secret is blocked');

// Test blockSecretUnsafeAction - no secret
const noBlock = secretGuard.blockSecretUnsafeAction(
  'memory.write',
  'Hello world',
  'memory'
);
assert(noBlock.blocked === false, 'Clean payload not blocked');

// Test buildSecretGuardReport
const report = secretGuard.buildSecretGuardReport({ blocked: false, reason: null, scan: { hasSecret: false, matches: [] } });
assert(report.safe === true, 'Report says safe');
assert(report.summary.includes('No secrets'), 'Report summary correct');

const blockReport = secretGuard.buildSecretGuardReport({ blocked: true, reason: 'Blocked', scan: { hasSecret: true, matches: [{ label: 'TOKEN' }] } });
assert(blockReport.blocked === true, 'Block report shows blocked');

// Test SECRET_PATTERNS export
assert(Array.isArray(secretGuard.SECRET_PATTERNS), 'SECRET_PATTERNS is array');
assert(secretGuard.SECRET_PATTERNS.length > 10, 'Multiple secret patterns defined');

console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);

'use strict';

const assert = require('assert');
const gate = require('../src/research/research-safety-gate');

const blocked = gate.runResearchSafetyGate({ question: 'ini GITHUB_TOKEN saya ghp_abcdef123456 simpan sebagai source' });
assert.strictEqual(blocked.allowed, false, 'secret-like input blocked');
assert(!JSON.stringify(blocked).includes('ghp_abcdef123456'), 'secret redacted');
const allowed = gate.runResearchSafetyGate({ question: 'riset deploy Render Node.js' });
assert.strictEqual(allowed.allowed, true, 'safe research input allowed');
console.log('test-research-safety-gate: ok');


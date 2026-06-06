'use strict';

const di = require('../src/knowledge/documentation-intelligence');
const path = require('path');
let passed = 0;
let failed = 0;
function assert(cond, name) { if (cond) { passed++; console.log('  PASS:', name); } else { failed++; console.log('  FAIL:', name); } }

console.log('test-documentation-intelligence');

const docs = di.scanProjectDocs({ rootDir: path.resolve(__dirname, '..') });
assert(docs['AGENTS.md'].exists, 'AGENTS.md exists');
assert(docs['docs/AGENT_HANDOFF.md'].exists, 'AGENT_HANDOFF.md exists');
assert(docs['docs/ARCHITECTURE_MAP.md'].exists, 'ARCHITECTURE_MAP.md exists');
assert(docs['docs/INTEGRATION_CONTRACT.md'].exists, 'INTEGRATION_CONTRACT.md exists');
assert(docs['docs/TESTING.md'].exists, 'TESTING.md exists');
assert(docs['README.md'].exists, 'README.md exists');

const outOfSync = di.detectDocsOutOfSync({ rootDir: path.resolve(__dirname, '..') });
assert(Array.isArray(outOfSync), 'outOfSync returns array');

const missingPhase = di.detectMissingPhaseDocs({ rootDir: path.resolve(__dirname, '..') });
assert(Array.isArray(missingPhase), 'missing phase docs returns array');

const missingEnv = di.detectMissingEnvDocs({ rootDir: path.resolve(__dirname, '..') });
assert(Array.isArray(missingEnv), 'missing env docs returns array');

const archGaps = di.detectArchitectureMapGaps({ rootDir: path.resolve(__dirname, '..') });
assert(Array.isArray(archGaps), 'architecture map gaps returns array');

const handoffGaps = di.detectHandoffGaps({ rootDir: path.resolve(__dirname, '..') });
assert(Array.isArray(handoffGaps), 'handoff gaps returns array');

const agentsGaps = di.detectAgentsGaps({ rootDir: path.resolve(__dirname, '..') });
assert(Array.isArray(agentsGaps), 'agents gaps returns array');

const testingGaps = di.detectTestingGaps({ rootDir: path.resolve(__dirname, '..') });
assert(Array.isArray(testingGaps), 'testing gaps returns array');

const suggestion = di.suggestDocumentationUpdates({ rootDir: path.resolve(__dirname, '..') });
assert(suggestion.findings.length > 0, 'suggestion has findings');
assert(suggestion.noDirectEdit === true, 'no direct edit');
assert(typeof suggestion.proposalRequired === 'boolean', 'proposalRequired boolean');

console.log(`\n  Total: ${passed + failed} | PASS: ${passed} | FAIL: ${failed}`);
process.exit(failed > 0 ? 1 : 0);

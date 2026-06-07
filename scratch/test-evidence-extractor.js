'use strict';

const assert = require('assert');
const evidence = require('../src/research/evidence-extractor');

const task = { id: 't1', topic: 'deploy Render', question: 'cara deploy', sourceRequirements: { requiredTypes: ['project_doc'] }, sources: [{ type: 'project_doc' }] };
const items = evidence.extractEvidenceFromSources([{ id: 's1', summary: 'Render deploy uses env names only. No secret values should be stored.', safeExcerpt: 'Render deploy uses env names only. No secret values should be stored.', credibilityScore: 90 }], task);
assert(items.length > 0, 'evidence extracted');
assert(items[0].confidence > 0.6, 'confidence assigned');
assert(Array.isArray(evidence.detectMissingEvidence(task, items)), 'missing evidence returns array');
console.log('test-evidence-extractor: ok');


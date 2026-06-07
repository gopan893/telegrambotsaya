'use strict';

const assert = require('assert');
const freshness = require('../src/research/research-freshness-checker');

assert.strictEqual(freshness.determineFreshnessRequirement({ scope: 'api_docs' }), 'high');
assert.strictEqual(freshness.determineFreshnessRequirement({ scope: 'project_docs' }), 'local_repo_truth');
assert(freshness.buildFreshnessWarning({ scope: 'deployment' }).includes('terbaru'), 'deployment warns freshness');
console.log('test-research-freshness-checker: ok');


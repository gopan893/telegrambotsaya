'use strict';

const assert = require('assert');
const agent = require('../src/research/documentation-agent');

const plan = agent.createDocumentationPlan({ topic: 'buat dokumentasi env project ini', userId: 'u1' });
assert(plan.ok, 'doc plan created');
assert.strictEqual(plan.plan.docType, 'env guide');
assert(plan.plan.affectedDocs.length > 0, 'affected docs suggested');
console.log('test-documentation-agent: ok');


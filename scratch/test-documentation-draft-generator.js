'use strict';

const assert = require('assert');
const draft = require('../src/research/documentation-draft-generator');

const res = draft.generateDocumentationDraft({ docType: 'env guide', topic: 'env', envList: ['TELEGRAM_TOKEN=secret-value', 'DATABASE_URL=postgresql://secret'] });
assert(res.ok, 'draft generated');
assert(res.draft.body.includes('TELEGRAM_TOKEN'), 'env name included');
assert(!res.draft.body.includes('secret-value'), 'env value excluded');
assert(!res.draft.body.includes('postgresql://secret'), 'connection string excluded');
console.log('test-documentation-draft-generator: ok');


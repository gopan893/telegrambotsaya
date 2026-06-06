'use strict';

const assert = require('assert');
const analyzer = require('../src/observability/root-cause-analyzer');

(async () => {
  const result = await analyzer.analyzeRootCause({ id: 'inc_test', title: 'Dashboard UI is not defined after push', summary: 'tab blank overview fallback' }, {});
  assert(result.confidence >= 0.7, 'dashboard root cause confidence high enough');
  assert((result.affectedFiles || []).some(file => file.includes('public/dashboard')), 'dashboard files suggested');
  assert(!JSON.stringify(result).includes('sk-'), 'no secret leak');
  console.log('test-root-cause-analyzer: ok');
})();

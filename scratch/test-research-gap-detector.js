'use strict';

const assert = require('assert');
const gaps = require('../src/research/research-gap-detector');

const task = { scope: 'api_docs', sourceRequirements: { requiredTypes: ['project_doc'], externalSearchNeeded: true }, sources: [] };
const result = gaps.detectResearchGaps(task, []);
assert(result.some(gap => gap.includes('project_doc') || gap.includes('project documentation')), 'missing docs gap detected');
assert(result.some(gap => /web|unknown/i.test(gap)), 'missing live web gap detected');
assert(gaps.suggestNextResearchSteps(task, result).length > 0, 'next steps generated');
console.log('test-research-gap-detector: ok');


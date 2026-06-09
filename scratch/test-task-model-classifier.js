'use strict';

const classifier = require('../src/model-router/task-model-classifier');

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) pass++; else { fail++; console.error(`FAIL: ${msg}`); } }

// classifyModelTask
assert(classifier.classifyModelTask('riset Gemini Vision API') === 'research', 'classifyModelTask research');
assert(classifier.classifyModelTask('implementasi function untuk kalkulator') === 'coding_light', 'classifyModelTask coding_light');
assert(classifier.classifyModelTask('implementasi full architecture heavy complex') === 'coding_heavy', 'classifyModelTask coding_heavy from keywords');
assert(classifier.classifyModelTask('apa kabar?') === 'simple_chat', 'classifyModelTask simple_chat');
assert(classifier.classifyModelTask('mood saya hari ini') === 'private_lifeos', 'classifyModelTask private_lifeos');
assert(classifier.classifyModelTask('ringkas dokumen ini') === 'docs_summary', 'classifyModelTask docs_summary');
assert(classifier.classifyModelTask('analisa gambar ini') === 'vision', 'classifyModelTask vision');

// estimateTaskComplexity
assert(classifier.estimateTaskComplexity('simple') === 'low', 'estimateTaskComplexity low');
assert(classifier.estimateTaskComplexity('a '.repeat(50)) === 'medium', 'estimateTaskComplexity medium');

// detection functions
assert(classifier.detectVisionTask('analisa gambar ini'), 'detectVisionTask true');
assert(!classifier.detectVisionTask('apa itu AI'), 'detectVisionTask false');
assert(classifier.detectCodingTask('buat function'), 'detectCodingTask true');
assert(classifier.detectResearchTask('riset Gemini'), 'detectResearchTask true');
assert(classifier.detectPrivateTask('mood saya'), 'detectPrivateTask true');
assert(classifier.detectLowCostTask('simple'), 'detectLowCostTask true');

console.log(`Result: ${pass} PASS, ${fail} FAIL`);
process.exit(fail ? 1 : 0);

'use strict';

const research = require('../src/research');

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) pass++; else { fail++; console.error(`FAIL: ${msg}`); } }

// comparison matrix
const options = [{ name: 'Groq', quality: 4, cost: 2, latency: 5 }, { name: 'Mistral', quality: 4, cost: 3, latency: 3 }];
const matrix = research.comparisonMatrixGenerator.generateComparisonMatrix({ options });
assert(matrix.matrix.length === 2, 'matrix 2 items');
assert(matrix.dimensions.includes('cost'), 'matrix has cost dimension');

// API comparison
const apiOpts = [{ name: 'REST API', easeOfUse: 4 }, { name: 'GraphQL', easeOfUse: 3 }];
const apiMatrix = research.comparisonMatrixGenerator.compareApiOptions(apiOpts);
assert(apiMatrix.matrix.length === 2, 'api comparison 2 items');

// Model comparison
const modelOpts = [{ name: 'Ollama' }, { name: 'GPT-4' }];
const modelMatrix = research.comparisonMatrixGenerator.compareModelOptions(modelOpts);
assert(modelMatrix.matrix.length === 2, 'model comparison 2 items');

// Cost/Privacy/Quality
const cpq = research.comparisonMatrixGenerator.compareCostPrivacyQuality([{ cost: 2, privacy: 5, quality: 3 }]);
assert(cpq.matrix.length === 1, 'cost privacy quality 1 item');

console.log(`Result: ${pass} PASS, ${fail} FAIL`);
process.exit(fail ? 1 : 0);

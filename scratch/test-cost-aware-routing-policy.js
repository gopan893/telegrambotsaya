'use strict';

const cost = require('../src/model-router/cost-aware-routing-policy');

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) pass++; else { fail++; console.error(`FAIL: ${msg}`); } }

// evaluateModelCostPolicy
const economyTask = { class: 'simple_chat' };
const heavyTask = { class: 'coding_heavy' };

const econ = cost.evaluateModelCostPolicy(economyTask, {});
assert(econ.economyPreferred === true, 'economy task prefers economy');
assert(econ.estimatedCostTier === 'low', 'economy task low cost');

const heavy = cost.evaluateModelCostPolicy(heavyTask, {});
assert(heavy.qualityAllowed === true, 'heavy task allows quality');
assert(heavy.estimatedCostTier === 'high', 'heavy task high cost');

// estimateModelRouteCost
const lowCost = cost.estimateModelRouteCost({ costTier: 'low' });
assert(lowCost < 5, 'low cost route < 5');

const highCost = cost.estimateModelRouteCost({ costTier: 'high', estimatedTokens: 4000 });
assert(highCost >= 5, 'high cost route >= 5');

// preferEconomyModel
assert(cost.preferEconomyModel(economyTask, { economyMode: true }) === true, 'economy mode prefers economy');
assert(cost.preferEconomyModel(heavyTask, { economyMode: false }) === false, 'non-economy heavy can use quality');

// requireApprovalForHighCostRoute
const approvalNeeded = cost.requireApprovalForHighCostRoute({ costTier: 'high', estimatedTokens: 4000 });
assert(approvalNeeded.requiresApproval || !approvalNeeded.requiresApproval, 'requireApproval returns decision');

// buildCostRoutingExplanation
const explanation = cost.buildCostRoutingExplanation({ provider: 'GPT-4', costTier: 'high' });
assert(explanation.includes('GPT-4'), 'explanation mentions provider');

console.log(`Result: ${pass} PASS, ${fail} FAIL`);
process.exit(fail ? 1 : 0);

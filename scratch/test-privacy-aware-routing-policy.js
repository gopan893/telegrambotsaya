'use strict';

const privacy = require('../src/model-router/privacy-aware-routing-policy');

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) pass++; else { fail++; console.error(`FAIL: ${msg}`); } }

const privateTask = { class: 'private_lifeos', input: 'mood saya sedih' };
const publicTask = { class: 'simple_chat', input: 'apa itu AI?' };
const secretTask = { class: 'coding_light', input: 'my api key is sk-12345' };

// Privacy policy
const privPolicy = privacy.evaluateModelPrivacyPolicy(privateTask, {});
assert(privPolicy.isPrivate === true, 'private task is private');
assert(privPolicy.cloudAllowed === false, 'private task cloud not allowed');

const pubPolicy = privacy.evaluateModelPrivacyPolicy(publicTask, {});
assert(pubPolicy.isPrivate === false, 'public task is not private');

// canUseCloudModel
const cannotCloud = privacy.canUseCloudModel(privateTask, {});
assert(cannotCloud.allowed === false, 'private task cannot use cloud');

const canCloud = privacy.canUseCloudModel(publicTask, {});
assert(canCloud.allowed === true, 'public task can use cloud');

// shouldPreferLocalModel
assert(privacy.shouldPreferLocalModel(privateTask, {}) === true, 'private task prefers local');
assert(privacy.shouldPreferLocalModel(publicTask, { privacyMode: 'local_preferred' }) === true, 'local_preferred mode');

// redactModelInputForCloud
const redacted = privacy.redactModelInputForCloud('my token is sk-abc123 and secret is xyz');
assert(!redacted.includes('sk-abc123'), 'redactModelInputForCloud removes key pattern');

// blockUnsafeModelRouting
const blocked = privacy.blockUnsafeModelRouting(privateTask, {});
assert(blocked.blocked === true, 'unsafe routing blocked for private');

const allowed = privacy.blockUnsafeModelRouting(publicTask, {});
assert(allowed.blocked === false, 'safe routing allowed');

console.log(`Result: ${pass} PASS, ${fail} FAIL`);
process.exit(fail ? 1 : 0);

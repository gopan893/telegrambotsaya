'use strict';

const assert = require('assert');
const classifier = require('../src/observability/incident-classifier');

assert.strictEqual(classifier.classifyIncidentSeverity({ title: 'DATABASE_URL bocor di log' }), 'critical');
assert.strictEqual(classifier.classifyIncidentSeverity({ title: 'dashboard broken after push' }), 'high');
assert(classifier.classifyAffectedSystems({ title: 'PostgreSQL disconnected' }).includes('storage'));
assert(classifier.determineIncidentPriority({ title: 'executor approval bypass' }).priorityScore >= 100);
console.log('test-incident-classifier: ok');

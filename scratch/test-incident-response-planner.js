'use strict';

const assert = require('assert');
const store = require('../src/observability/incident-store');
const planner = require('../src/observability/incident-response-planner');

(async () => {
  const services = {};
  const incident = await store.upsertIncident({ title: 'Render deploy failed', severity: 'critical', source: 'deploy', affectedSystems: ['deploy'] }, services);
  const result = await planner.createIncidentResponsePlan(incident.id, services);
  assert(result.ok, 'response plan created');
  assert(result.plan.requiresEvaluation, 'evaluation required');
  assert(result.plan.requiresExecutorApproval, 'executor approval required');
  assert((result.plan.actions || []).some(action => action.type === 'restore.run'), 'rollback action is proposal action only');
  console.log('test-incident-response-planner: ok');
})();

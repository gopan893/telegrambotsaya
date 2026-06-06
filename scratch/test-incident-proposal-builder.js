'use strict';

const assert = require('assert');
const store = require('../src/observability/incident-store');
const planner = require('../src/observability/incident-response-planner');
const builder = require('../src/observability/incident-proposal-builder');

(async () => {
  const services = {
    executorSystem: {
      executionPlanner: {
        createExecutionProposal: async input => ({ ok: true, proposal: { id: 'exec_test', status: 'pending_approval', riskLevel: 'danger', proposedActions: input.proposedActions } })
      }
    },
    evaluationSystem: { runEvalCases: () => ({ incidentProposalSafetyScore: 100 }) }
  };
  const incident = await store.upsertIncident({ title: 'app down after deploy', severity: 'critical', affectedSystems: ['deploy'] }, services);
  const planned = await planner.createIncidentResponsePlan(incident.id, services);
  const result = await builder.createIncidentRollbackProposal(planned.plan.id, services, { userId: 'admin' });
  assert(result.ok, 'rollback proposal created');
  assert.strictEqual(result.proposal.status, 'pending_approval');
  assert(!JSON.stringify(result).includes('run completed'), 'proposal creation did not execute');
  console.log('test-incident-proposal-builder: ok');
})();

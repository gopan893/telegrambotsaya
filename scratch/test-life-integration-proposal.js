'use strict';

const assert = require('assert');
const lifeos = require('../src/lifeos');

function services() {
  return { __lifeosStore: {}, workspaceId: 'ws_life', userId: 'user_life', actorType: 'test' };
}

(async () => {
  const svc = services();
  const calendar = await lifeos.lifeIntegrationProposal.createCalendarEventProposal({ title: 'Meeting besok' }, svc);
  assert.equal(calendar.ok, true);
  assert.equal(calendar.proposal.directExternalWrite, false);
  assert.equal(calendar.proposal.didExecute, false);
  assert.equal(calendar.proposal.actionType, 'calendar.event.create');

  const gmail = await lifeos.lifeIntegrationProposal.createGmailDraftProposal({ title: 'Draft email klien' }, svc);
  assert.equal(gmail.ok, true);
  assert.equal(gmail.proposal.directExternalWrite, false);
  assert.ok(gmail.proposal.summary.includes('disabled'));

  const routine = await lifeos.lifeIntegrationProposal.createRoutineProposalFromLifePlan({ title: 'Rutinitas belajar' }, svc);
  assert.equal(routine.ok, true);
  assert.equal(routine.proposal.actionType, 'routine.schedule.propose');

  const gate = await lifeos.lifeIntegrationProposal.runLifeIntegrationEvaluationGate({ title: 'Safe plan' }, svc);
  assert.equal(gate.ok, true);
  assert.equal(gate.dryRun, true);

  const executor = await lifeos.lifeIntegrationProposal.createLifeExecutorProposal({ title: 'Life proposal', actionType: 'life.test' }, svc);
  assert.equal(executor.ok, true);
  assert.equal(executor.proposal.didExecute, false);

  const blocked = await lifeos.lifeIntegrationProposal.createCalendarEventProposal({ title: 'token=abc123' }, svc);
  assert.equal(blocked.ok, false);

  console.log('test-life-integration-proposal: ok');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});

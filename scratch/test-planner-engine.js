'use strict';

const assert = require('assert');
const planner = require('../src/planner');
const workspace = require('../src/workspace');

function createServices() {
  const db = {};
  return {
    env: { OWNER_CHAT_ID: 'owner' },
    storageManager: {
      async safeRead(key, fallback) {
        return Object.prototype.hasOwnProperty.call(db, key) ? JSON.parse(JSON.stringify(db[key])) : fallback;
      },
      async safeWrite(key, value) {
        db[key] = JSON.parse(JSON.stringify(value));
        return true;
      },
      getRepositories() {
        return {};
      }
    },
    __db: db
  };
}

async function setupWorkspace(services) {
  await workspace.store.createWorkspace({
    id: 'ws_plan_test',
    name: 'Planner Test Workspace',
    ownerId: 'owner',
    members: [
      { userId: 'owner', role: 'owner', status: 'active' },
      { userId: 'editor', role: 'editor', status: 'active' },
      { userId: 'viewer', role: 'viewer', status: 'active' }
    ]
  }, services);
}

(async () => {
  const services = createServices();
  await setupWorkspace(services);

  const denied = await planner.plannerEngine.createPlan({
    actorId: 'viewer',
    userId: 'viewer',
    workspaceId: 'ws_plan_test',
    title: 'Viewer should fail'
  }, services);
  assert.strictEqual(denied.ok, false, 'viewer cannot create plan');

  const created = await planner.plannerEngine.createPlan({
    actorId: 'editor',
    userId: 'editor',
    workspaceId: 'ws_plan_test',
    title: 'Phase 15 Planner',
    description: 'Implement long-term planner',
    status: 'active',
    tasks: [{ title: 'Create engine', impact: 'high', urgency: 'high' }]
  }, services);
  assert.strictEqual(created.ok, true, 'editor can create plan');
  assert.strictEqual(created.tasks.length, 1, 'initial task created');

  const listed = await planner.plannerEngine.listPlans({ actorId: 'editor', userId: 'editor', workspaceId: 'ws_plan_test' }, services);
  assert.strictEqual(listed.length, 1, 'plan listed');

  const updated = await planner.plannerEngine.updatePlan(created.plan.id, { actorId: 'editor', title: 'Updated Planner' }, services);
  assert.strictEqual(updated.ok, true, 'plan updated');
  assert.strictEqual(updated.plan.title, 'Updated Planner');

  const generated = await planner.plannerEngine.generatePlanFromText('Bangun dashboard planner, tambah API, lalu test permissions', {
    actorId: 'editor',
    userId: 'editor',
    workspaceId: 'ws_plan_test'
  }, services);
  assert.strictEqual(generated.ok, true, 'generate plan from text works');
  assert.ok(generated.tasks.length >= 1, 'generated tasks');

  const next = await planner.plannerEngine.suggestNextActions('ws_plan_test', 'editor', { ...services, actorId: 'editor' });
  assert.strictEqual(next.ok, true, 'next actions ok');
  assert.ok(next.actions.length >= 1, 'next actions returned');

  const archive = await planner.plannerEngine.archivePlan(created.plan.id, { ...services, actorId: 'editor' });
  assert.strictEqual(archive.ok, true, 'plan archived');
  assert.strictEqual(archive.plan.status, 'archived');

  const secret = await planner.plannerEngine.generatePlanFromText('pakai DATABASE_URL=postgresql://user:pass@host/db', {
    actorId: 'editor',
    userId: 'editor',
    workspaceId: 'ws_plan_test'
  }, services);
  assert.strictEqual(secret.ok, false, 'secret-like payload rejected');

  console.log('test-planner-engine: ok');
})().catch(err => {
  console.error(err);
  process.exit(1);
});

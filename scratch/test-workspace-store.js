'use strict';

const assert = require('assert');
const workspace = require('../src/workspace');

async function main() {
  const services = { __workspaceStore: {}, env: { OWNER_CHAT_ID: 'owner' } };

  const personal = await workspace.store.ensurePersonalWorkspace('u1', services);
  assert.strictEqual(personal.id, workspace.utils.getPersonalWorkspaceId('u1'));
  assert.strictEqual(personal.ownerId, 'u1');

  const created = await workspace.store.createWorkspace({
    name: 'Project Alpha',
    description: 'Workspace project AI OS',
    type: 'project',
    ownerId: 'owner'
  }, services);
  assert.ok(created.id.startsWith('ws_'));
  assert.strictEqual(created.members[0].role, 'owner');

  await workspace.store.addWorkspaceMember(created.id, 'u1', 'editor', services);
  let list = await workspace.store.listWorkspacesForUser('u1', services);
  assert.ok(list.some(item => item.id === created.id), 'member should see project workspace');

  await workspace.store.updateWorkspaceMemberRole(created.id, 'u1', 'viewer', services);
  const updated = await workspace.store.getWorkspace(created.id, services);
  assert.strictEqual(updated.members.find(member => member.userId === 'u1').role, 'viewer');

  await workspace.store.removeWorkspaceMember(created.id, 'u1', services);
  list = await workspace.store.listWorkspacesForUser('u1', services);
  assert.ok(!list.some(item => item.id === created.id), 'removed member should not see project workspace');

  const archived = await workspace.store.archiveWorkspace(created.id, services);
  assert.ok(archived.archivedAt, 'workspace should be archived');

  const personalArchive = await workspace.store.archiveWorkspace(personal.id, services);
  assert.strictEqual(personalArchive, null, 'personal workspace must not be archived');

  console.log('test-workspace-store: ok');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

'use strict';

const assert = require('assert');
const workspace = require('../src/workspace');

async function main() {
  const services = { __workspaceStore: {}, env: { OWNER_CHAT_ID: 'owner' } };
  const project = await workspace.store.createWorkspace({
    id: 'ws_project_permissions',
    name: 'Permissions Project',
    ownerId: 'owner',
    type: 'project'
  }, services);

  await workspace.store.addWorkspaceMember(project.id, 'editor', 'editor', services);
  await workspace.store.addWorkspaceMember(project.id, 'viewer', 'viewer', services);
  await workspace.store.addWorkspaceMember(project.id, 'guest', 'guest', services);

  assert.strictEqual(await workspace.permissions.getUserRole(project.id, 'owner', services), 'owner');
  assert.strictEqual(await workspace.permissions.hasWorkspacePermission('owner', project.id, 'danger', services), true);
  assert.strictEqual(await workspace.permissions.hasWorkspacePermission('editor', project.id, 'write', services), true);
  assert.strictEqual(await workspace.permissions.hasWorkspacePermission('viewer', project.id, 'write', services), false);
  assert.strictEqual(await workspace.permissions.hasWorkspacePermission('guest', project.id, 'read', services), false);
  assert.strictEqual(await workspace.permissions.hasWorkspacePermission('guest', project.id, 'limited_read', services), true);

  assert.strictEqual(await workspace.permissions.canAccessUserData('owner', 'viewer', project.id, 'read', services), true);
  assert.strictEqual(await workspace.permissions.canAccessUserData('viewer', 'owner', project.id, 'write', services), false);
  assert.strictEqual(await workspace.permissions.canAccessUserData('viewer', 'viewer', '', 'read', services), true);

  const summary = await workspace.permissions.getPermissionSummary('editor', project.id, services);
  assert.strictEqual(summary.role, 'editor');
  assert.strictEqual(summary.canWrite, true);
  assert.strictEqual(summary.canDanger, false);

  const filtered = workspace.guards.filterDataByWorkspace([
    { id: 'a', workspaceId: project.id },
    { id: 'b', metadata: { workspaceId: 'ws_other' } },
    { id: 'c' }
  ], project.id, workspace.utils.getPersonalWorkspaceId('owner'));
  assert.deepStrictEqual(filtered.map(item => item.id), ['a']);

  console.log('test-workspace-permissions: ok');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

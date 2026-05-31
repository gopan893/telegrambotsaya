'use strict';

const workspaceStore = require('./workspace-store');
const permissions = require('./workspace-permissions');
const utils = require('./workspace-utils');

function validateWorkspaceId(workspaceId = '') {
  const clean = String(workspaceId || '').trim();
  return /^[a-zA-Z0-9_-]{3,160}$/.test(clean) ? clean : '';
}

function validateRole(role = '') {
  const normalized = utils.normalizeRole(role);
  return ['owner', 'admin', 'editor', 'viewer', 'guest'].includes(normalized) ? normalized : '';
}

async function validateMembership(workspaceId, userId, services = {}) {
  const workspace = await workspaceStore.getWorkspace(workspaceId, services);
  if (!workspace) return { ok: false, error: 'WORKSPACE_NOT_FOUND' };
  const role = await permissions.getUserRole(workspace.id, userId, services);
  if (!role) return { ok: false, error: 'WORKSPACE_NOT_MEMBER' };
  return { ok: true, workspace, role };
}

async function attachWorkspaceContext(input = {}, services = {}) {
  const userId = String(input.userId || input.actorId || '').trim();
  let workspaceId = validateWorkspaceId(input.workspaceId || '');
  let workspace = workspaceId ? await workspaceStore.getWorkspace(workspaceId, services) : null;
  if (!workspace && userId) workspace = await workspaceStore.getDefaultWorkspaceForUser(userId, services);
  workspaceId = workspace?.id || workspaceId;
  const role = workspace && userId ? await permissions.getUserRole(workspace.id, userId, services) : null;
  return { ...input, workspaceId, workspace, role };
}

function filterDataByWorkspace(items = [], workspaceId = '', defaultWorkspaceId = '') {
  const target = String(workspaceId || defaultWorkspaceId || '').trim();
  if (!target) return Array.isArray(items) ? items : [];
  return (Array.isArray(items) ? items : []).filter(item => {
    const itemWorkspaceId = utils.getWorkspaceIdFromData(item, defaultWorkspaceId);
    return itemWorkspaceId === target;
  });
}

async function enforceWorkspaceAccess(userId, workspaceId, permission = 'read', services = {}) {
  const workspace = workspaceId
    ? await workspaceStore.getWorkspace(workspaceId, services)
    : await workspaceStore.getDefaultWorkspaceForUser(userId, services);
  if (!workspace) return { ok: false, error: 'WORKSPACE_NOT_FOUND' };
  const allowed = await permissions.hasWorkspacePermission(userId, workspace.id, permission, services);
  if (!allowed) return { ok: false, error: 'WORKSPACE_PERMISSION_DENIED', workspaceId: workspace.id, permission };
  const role = await permissions.getUserRole(workspace.id, userId, services);
  return { ok: true, workspace, role, workspaceId: workspace.id };
}

module.exports = {
  attachWorkspaceContext,
  enforceWorkspaceAccess,
  filterDataByWorkspace,
  validateMembership,
  validateRole,
  validateWorkspaceId
};


'use strict';

const workspaceStore = require('./workspace-store');
const utils = require('./workspace-utils');

const ROLE_PERMISSIONS = {
  owner: ['read', 'write', 'danger', 'ops', 'manage_members', 'limited_read'],
  admin: ['read', 'write', 'ops', 'manage_members', 'limited_read'],
  editor: ['read', 'write', 'limited_read'],
  viewer: ['read', 'limited_read'],
  guest: ['limited_read']
};

function roleHasPermission(role, permission) {
  if (!role) return false;
  return Boolean((ROLE_PERMISSIONS[utils.normalizeRole(role)] || []).includes(permission));
}

async function getUserRole(workspaceId, userId, services = {}) {
  const cleanUserId = String(userId || '').trim();
  if (!cleanUserId) return null;
  const workspace = workspaceId
    ? await workspaceStore.getWorkspace(workspaceId, services)
    : await workspaceStore.getDefaultWorkspaceForUser(cleanUserId, services);
  if (!workspace || utils.isWorkspaceArchived(workspace)) return null;
  if (workspace.ownerId === cleanUserId) return 'owner';
  const member = workspace.members.find(item => item.userId === cleanUserId && item.status === 'active');
  return member?.role || null;
}

async function hasWorkspacePermission(userId, workspaceId, permission, services = {}) {
  const workspace = workspaceId
    ? await workspaceStore.getWorkspace(workspaceId, services)
    : await workspaceStore.getDefaultWorkspaceForUser(userId, services);
  if (!workspace) return false;
  const role = await getUserRole(workspace.id, userId, services);
  return roleHasPermission(role, permission);
}

function requireWorkspacePermission(permission) {
  return async function workspacePermission(req, res, next) {
    const services = req.dashboardServices || req.app?.locals?.dashboardServices || {};
    const userId = req.workspaceActorId || req.query?.actorId || services.env?.OWNER_CHAT_ID || process.env.OWNER_CHAT_ID || '';
    const workspaceId = req.params?.workspaceId || req.query?.workspaceId || req.body?.workspaceId || '';
    const allowed = await hasWorkspacePermission(userId, workspaceId, permission, services);
    if (!allowed) {
      return res.status(403).json({ ok: false, error: 'WORKSPACE_PERMISSION_DENIED', permission });
    }
    return next();
  };
}

async function canAccessUserData(actorId, targetUserId, workspaceId, action = 'read', services = {}) {
  const actor = String(actorId || '').trim();
  const target = String(targetUserId || '').trim();
  const permission = action === 'read' ? 'read' : action === 'limited_read' ? 'limited_read' : action;
  const workspace = workspaceId
    ? await workspaceStore.getWorkspace(workspaceId, services)
    : await workspaceStore.getDefaultWorkspaceForUser(target || actor, services);
  if (!workspace) return false;
  if (actor && target && actor === target && workspace.id === utils.getPersonalWorkspaceId(target)) return true;
  return hasWorkspacePermission(actor, workspace.id, permission, services);
}

async function getPermissionSummary(userId, workspaceId, services = {}) {
  const workspace = workspaceId
    ? await workspaceStore.getWorkspace(workspaceId, services)
    : await workspaceStore.getDefaultWorkspaceForUser(userId, services);
  const role = workspace ? await getUserRole(workspace.id, userId, services) : null;
  const permissions = role ? (ROLE_PERMISSIONS[utils.normalizeRole(role)] || []) : [];
  return {
    userId: String(userId || ''),
    workspaceId: workspace?.id || '',
    role: role || 'none',
    permissions,
    canRead: permissions.includes('read'),
    canWrite: permissions.includes('write'),
    canDanger: permissions.includes('danger'),
    canOps: permissions.includes('ops'),
    canManageMembers: permissions.includes('manage_members')
  };
}

module.exports = {
  ROLE_PERMISSIONS,
  canAccessUserData,
  getPermissionSummary,
  getUserRole,
  hasWorkspacePermission,
  requireWorkspacePermission,
  roleHasPermission
};

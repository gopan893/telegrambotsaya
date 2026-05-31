'use strict';

const auditLog = require('./audit-log');
const serializers = require('./dashboard-serializers');
const guards = require('./dashboard-guards');
const workspace = require('../workspace');

function getActorId(req, services = {}) {
  return String(
    req.body?.actorId ||
    req.query?.actorId ||
    services.env?.OWNER_CHAT_ID ||
    process.env.OWNER_CHAT_ID ||
    'dashboard-admin'
  ).trim();
}

function getIp(req) {
  return req.ip || req.headers['x-forwarded-for'] || '';
}

function auditBase(req, action, patch = {}) {
  return {
    actorType: 'dashboard',
    actorId: patch.actorId || getActorId(req, patch.services || {}),
    action,
    targetType: patch.targetType || 'workspace',
    targetId: patch.targetId || '',
    userId: patch.userId || '',
    workspaceId: patch.workspaceId || '',
    actorRole: patch.actorRole || '',
    permission: patch.permission || '',
    decision: patch.decision || 'allowed',
    status: patch.status || 'ok',
    reason: patch.reason || '',
    beforeSummary: patch.beforeSummary || {},
    afterSummary: patch.afterSummary || {},
    ip: getIp(req),
    userAgent: req.headers['user-agent'] || ''
  };
}

async function record(req, services, action, patch = {}) {
  return auditLog.recordAuditLog(auditBase(req, action, { ...patch, services }), services);
}

async function requireWorkspaceAccess(req, res, services, permission) {
  const actorId = getActorId(req, services);
  const workspaceId = workspace.guards.validateWorkspaceId(req.params.workspaceId || req.query.workspaceId || req.body.workspaceId || '');
  if (!workspaceId) {
    return { ok: false, response: guards.safeDashboardResponse(res, { ok: false, error: 'INVALID_WORKSPACE_ID' }, 400) };
  }
  const summary = await workspace.permissions.getPermissionSummary(actorId, workspaceId, services);
  const allowed = await workspace.permissions.hasWorkspacePermission(actorId, workspaceId, permission, services);
  if (!allowed) {
    await record(req, services, `workspace/permission_denied/${permission}`, {
      actorId,
      actorRole: summary.role,
      workspaceId,
      permission,
      decision: 'denied',
      status: 'denied',
      reason: 'workspace permission denied'
    });
    return { ok: false, response: guards.safeDashboardResponse(res, { ok: false, error: 'WORKSPACE_PERMISSION_DENIED', permission }, 403) };
  }
  return { ok: true, actorId, actorRole: summary.role, workspaceId, summary };
}

function collectKnownUsers(workspaces = [], services = {}) {
  const users = new Map();
  const snapshot = services.getUsersSnapshot?.() || {};
  for (const [id, data] of Object.entries(snapshot || {})) {
    users.set(String(id), {
      userId: String(id),
      workspaceCount: 0,
      activeMode: data?.adaptive?.activeMode || null,
      lastSeenAt: data?.lastSeenAt || data?.updatedAt || null
    });
  }
  for (const item of workspaces) {
    if (item.ownerId) {
      const current = users.get(String(item.ownerId)) || { userId: String(item.ownerId), workspaceCount: 0 };
      current.workspaceCount += 1;
      current.ownerWorkspaceCount = Number(current.ownerWorkspaceCount || 0) + 1;
      users.set(String(item.ownerId), current);
    }
    for (const member of item.members || []) {
      if (!member.userId || member.status !== 'active') continue;
      const current = users.get(String(member.userId)) || { userId: String(member.userId), workspaceCount: 0 };
      current.workspaceCount += 1;
      users.set(String(member.userId), current);
    }
  }
  return Array.from(users.values()).sort((a, b) => String(a.userId).localeCompare(String(b.userId))).slice(0, 250);
}

function sanitizeUsers(users = []) {
  return users.map(user => guards.preventSecretLeak({
    userId: String(user.userId || '').slice(0, 80),
    workspaceCount: Number(user.workspaceCount || 0),
    ownerWorkspaceCount: Number(user.ownerWorkspaceCount || 0),
    activeMode: serializers.truncateText(user.activeMode || '', 80),
    lastSeenAt: user.lastSeenAt || null
  }));
}

function registerWorkspaceRoutes(router, services = {}) {
  router.use((req, _res, next) => {
    req.dashboardServices = services;
    next();
  });

  router.get('/workspaces', async (req, res) => {
    const actorId = getActorId(req, services);
    const items = req.query.all === 'true'
      ? await workspace.store.listAllWorkspaces(services, { includeArchived: req.query.includeArchived === 'true' })
      : await workspace.store.listWorkspacesForUser(actorId, services, { includeArchived: req.query.includeArchived === 'true' });
    return guards.safeDashboardResponse(res, { actorId, items: items.map(serializers.sanitizeWorkspace) });
  });

  router.post('/workspaces/create', guards.rateLimitDashboardAction, async (req, res) => {
    const actorId = getActorId(req, services);
    const created = await workspace.store.createWorkspace({
      name: req.body?.name,
      description: req.body?.description,
      type: req.body?.type || 'project',
      ownerId: req.body?.ownerId || actorId
    }, services);
    if (!created) return guards.safeDashboardResponse(res, { ok: false, error: 'WORKSPACE_CREATE_FAILED' }, 400);
    const summary = await workspace.permissions.getPermissionSummary(actorId, created.id, services);
    await record(req, services, 'workspace/create', {
      actorId,
      actorRole: summary.role,
      workspaceId: created.id,
      targetId: created.id,
      permission: 'write',
      afterSummary: serializers.sanitizeWorkspace(created)
    });
    return guards.safeDashboardResponse(res, { ok: true, workspace: serializers.sanitizeWorkspace(created) });
  });

  router.get('/workspaces/:workspaceId', async (req, res) => {
    const access = await requireWorkspaceAccess(req, res, services, 'read');
    if (!access.ok) return access.response;
    const item = await workspace.store.getWorkspace(access.workspaceId, services);
    return guards.safeDashboardResponse(res, { workspace: serializers.sanitizeWorkspace(item), permission: serializers.sanitizePermissionSummary(access.summary) });
  });

  router.get('/workspaces/:workspaceId/members', async (req, res) => {
    const access = await requireWorkspaceAccess(req, res, services, 'read');
    if (!access.ok) return access.response;
    const item = await workspace.store.getWorkspace(access.workspaceId, services);
    return guards.safeDashboardResponse(res, { items: (item?.members || []).filter(member => member.status === 'active').map(serializers.sanitizeMember) });
  });

  router.post('/workspaces/:workspaceId/members/add', guards.rateLimitDashboardAction, async (req, res) => {
    const access = await requireWorkspaceAccess(req, res, services, 'manage_members');
    if (!access.ok) return access.response;
    const userId = guards.validateUserId(req.body?.userId);
    const role = workspace.guards.validateRole(req.body?.role || 'viewer');
    if (!userId || !role) return guards.safeDashboardResponse(res, { ok: false, error: 'INVALID_MEMBER' }, 400);
    const before = await workspace.store.getWorkspace(access.workspaceId, services);
    const updated = await workspace.store.addWorkspaceMember(access.workspaceId, userId, role, services);
    await record(req, services, 'workspace/member_add', {
      actorId: access.actorId,
      actorRole: access.actorRole,
      workspaceId: access.workspaceId,
      targetId: userId,
      userId,
      permission: 'manage_members',
      beforeSummary: serializers.sanitizeWorkspace(before),
      afterSummary: serializers.sanitizeWorkspace(updated)
    });
    return guards.safeDashboardResponse(res, { ok: true, workspace: serializers.sanitizeWorkspace(updated) });
  });

  router.post('/workspaces/:workspaceId/members/role', guards.rateLimitDashboardAction, async (req, res) => {
    const access = await requireWorkspaceAccess(req, res, services, 'manage_members');
    if (!access.ok) return access.response;
    const userId = guards.validateUserId(req.body?.userId);
    const role = workspace.guards.validateRole(req.body?.role || 'viewer');
    if (!userId || !role || role === 'owner') return guards.safeDashboardResponse(res, { ok: false, error: 'INVALID_ROLE_CHANGE' }, 400);
    const before = await workspace.store.getWorkspace(access.workspaceId, services);
    const updated = await workspace.store.updateWorkspaceMemberRole(access.workspaceId, userId, role, services);
    if (!updated) return guards.safeDashboardResponse(res, { ok: false, error: 'MEMBER_NOT_FOUND' }, 404);
    await record(req, services, 'workspace/member_role', {
      actorId: access.actorId,
      actorRole: access.actorRole,
      workspaceId: access.workspaceId,
      targetId: userId,
      userId,
      permission: 'manage_members',
      beforeSummary: serializers.sanitizeWorkspace(before),
      afterSummary: serializers.sanitizeWorkspace(updated)
    });
    return guards.safeDashboardResponse(res, { ok: true, workspace: serializers.sanitizeWorkspace(updated) });
  });

  router.post('/workspaces/:workspaceId/members/remove', guards.rateLimitDashboardAction, async (req, res) => {
    const access = await requireWorkspaceAccess(req, res, services, 'manage_members');
    if (!access.ok) return access.response;
    const userId = guards.validateUserId(req.body?.userId);
    if (!userId) return guards.safeDashboardResponse(res, { ok: false, error: 'INVALID_USER_ID' }, 400);
    const before = await workspace.store.getWorkspace(access.workspaceId, services);
    const updated = await workspace.store.removeWorkspaceMember(access.workspaceId, userId, services);
    if (!updated) return guards.safeDashboardResponse(res, { ok: false, error: 'MEMBER_NOT_FOUND_OR_OWNER' }, 404);
    await record(req, services, 'workspace/member_remove', {
      actorId: access.actorId,
      actorRole: access.actorRole,
      workspaceId: access.workspaceId,
      targetId: userId,
      userId,
      permission: 'manage_members',
      beforeSummary: serializers.sanitizeWorkspace(before),
      afterSummary: serializers.sanitizeWorkspace(updated)
    });
    return guards.safeDashboardResponse(res, { ok: true, workspace: serializers.sanitizeWorkspace(updated) });
  });

  router.post('/workspaces/:workspaceId/archive', guards.rateLimitDashboardAction, async (req, res) => {
    const access = await requireWorkspaceAccess(req, res, services, 'danger');
    if (!access.ok) return access.response;
    if (req.body?.confirmationText !== 'ARCHIVE') return guards.safeDashboardResponse(res, { ok: false, error: 'DOUBLE_CONFIRM_REQUIRED', expectedWord: 'ARCHIVE' }, 400);
    const before = await workspace.store.getWorkspace(access.workspaceId, services);
    const updated = await workspace.store.archiveWorkspace(access.workspaceId, services);
    if (!updated) return guards.safeDashboardResponse(res, { ok: false, error: 'WORKSPACE_ARCHIVE_FAILED' }, 400);
    await record(req, services, 'workspace/archive', {
      actorId: access.actorId,
      actorRole: access.actorRole,
      workspaceId: access.workspaceId,
      targetId: access.workspaceId,
      permission: 'danger',
      beforeSummary: serializers.sanitizeWorkspace(before),
      afterSummary: serializers.sanitizeWorkspace(updated),
      reason: req.body?.reason || ''
    });
    return guards.safeDashboardResponse(res, { ok: true, workspace: serializers.sanitizeWorkspace(updated) });
  });

  router.get('/permissions/me', async (req, res) => {
    const actorId = getActorId(req, services);
    const workspaceId = workspace.guards.validateWorkspaceId(req.query.workspaceId || '') || (await workspace.store.getDefaultWorkspaceForUser(actorId, services))?.id;
    const summary = await workspace.permissions.getPermissionSummary(actorId, workspaceId, services);
    return guards.safeDashboardResponse(res, serializers.sanitizePermissionSummary(summary));
  });

  router.get('/users', async (req, res) => {
    const items = collectKnownUsers(await workspace.store.listAllWorkspaces(services, { includeArchived: true }), services);
    return guards.safeDashboardResponse(res, { items: sanitizeUsers(items) });
  });

  router.get('/users/:userId/overview', async (req, res) => {
    const targetUserId = guards.validateUserId(req.params.userId);
    const actorId = getActorId(req, services);
    if (!targetUserId) return guards.safeDashboardResponse(res, { ok: false, error: 'INVALID_USER_ID' }, 400);
    const workspaceId = workspace.guards.validateWorkspaceId(req.query.workspaceId || '') || (await workspace.store.getDefaultWorkspaceForUser(targetUserId, services))?.id;
    const allowed = await workspace.permissions.canAccessUserData(actorId, targetUserId, workspaceId, 'read', services);
    if (!allowed) {
      await record(req, services, 'workspace/user_overview_denied', {
        actorId,
        workspaceId,
        targetId: targetUserId,
        userId: targetUserId,
        permission: 'read',
        decision: 'denied',
        status: 'denied'
      });
      return guards.safeDashboardResponse(res, { ok: false, error: 'WORKSPACE_PERMISSION_DENIED' }, 403);
    }
    return guards.safeDashboardResponse(res, guards.preventSecretLeak({
      userId: targetUserId,
      workspaceId,
      workspaces: (await workspace.store.listWorkspacesForUser(targetUserId, services)).map(serializers.sanitizeWorkspace)
    }));
  });
}

module.exports = {
  collectKnownUsers,
  getActorId,
  registerWorkspaceRoutes
};


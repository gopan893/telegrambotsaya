'use strict';

const WRITE_ACTION_PATTERN = /\.(create|update|change|send|post|write|comment|pr\.create|issue\.create)$/i;
const DANGER_ACTION_PATTERN = /(restore|delete|permission|config\.change|cloudflare\.config\.change|send|webhook\.send)/i;

function normalizeRole(actor = {}) {
  return String(actor.role || actor.actorRole || actor.workspaceRole || 'owner').toLowerCase();
}

function isReadOnlyAction(action = '') {
  const clean = String(action || '');
  if (/\.plan$/i.test(clean)) return false;
  if (WRITE_ACTION_PATTERN.test(clean)) return false;
  if (DANGER_ACTION_PATTERN.test(clean)) return false;
  return /\.(status|list|info|check|diagnose|validate|preview)$/i.test(clean);
}

function requireOwnerAdminForDanger(connectorId, action) {
  return DANGER_ACTION_PATTERN.test(`${connectorId}.${action}`);
}

function requireWorkspaceAccess(connectorId, action) {
  return Boolean(connectorId && action);
}

async function checkConnectorPermission(connectorId, action, actor = {}, workspace = {}, services = {}) {
  const actorId = String(actor.actorId || actor.userId || actor.id || services.actorId || services.userId || '').trim();
  if (!actorId && !services.allowAnonymousIntegrationTests) {
    return buildConnectorPermissionDecision(false, 'UNKNOWN_ACTOR_DENIED', connectorId, action, actor, workspace);
  }
  const role = normalizeRole(actor);
  const readOnly = isReadOnlyAction(action);
  const danger = requireOwnerAdminForDanger(connectorId, action);
  if (danger && !['owner', 'admin'].includes(role)) {
    return buildConnectorPermissionDecision(false, 'OWNER_ADMIN_REQUIRED', connectorId, action, { ...actor, role }, workspace);
  }
  if (!readOnly && !['owner', 'admin', 'editor'].includes(role)) {
    return buildConnectorPermissionDecision(false, 'WRITE_PERMISSION_REQUIRED', connectorId, action, { ...actor, role }, workspace);
  }
  if (services.workspace?.permissions?.hasPermission) {
    try {
      const required = readOnly ? 'read' : 'write';
      const ok = await services.workspace.permissions.hasPermission(actorId, workspace.workspaceId || workspace.id || 'default', required, services);
      if (ok === false) return buildConnectorPermissionDecision(false, 'WORKSPACE_PERMISSION_DENIED', connectorId, action, { ...actor, role }, workspace);
    } catch (_) {}
  }
  return buildConnectorPermissionDecision(true, readOnly ? 'read_only_allowed' : 'write_proposal_allowed', connectorId, action, { ...actor, role }, workspace);
}

function buildConnectorPermissionDecision(allowed, reason, connectorId, action, actor = {}, workspace = {}) {
  return {
    allowed: Boolean(allowed),
    reason,
    connectorId,
    action,
    actorId: String(actor.actorId || actor.userId || actor.id || ''),
    actorRole: normalizeRole(actor),
    workspaceId: String(workspace.workspaceId || workspace.id || 'default'),
    readOnly: isReadOnlyAction(action),
    ownerAdminRequired: requireOwnerAdminForDanger(connectorId, action)
  };
}

module.exports = {
  buildConnectorPermissionDecision,
  checkConnectorPermission,
  isReadOnlyAction,
  requireOwnerAdminForDanger,
  requireWorkspaceAccess
};

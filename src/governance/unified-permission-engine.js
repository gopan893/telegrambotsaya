'use strict';

function resolveActorRole(actor, services) {
  const env = (services && services.env) || process.env;
  const actorId = String(actor && (actor.id || actor.userId || actor.chatId || actor)).trim();

  if (!actorId) return 'unknown';

  const ownerChatId = String(env.OWNER_CHAT_ID || '').trim();
  if (ownerChatId && actorId === ownerChatId) return 'owner';

  const adminIdsStr = String(env.ADMIN_IDS || env.ADMIN_LIST || '');
  const adminIds = adminIdsStr ? adminIdsStr.split(',').map(s => s.trim()).filter(Boolean) : [];

  if (adminIds.length === 0) return 'user';

  if (adminIds.includes(actorId)) return 'admin';

  return 'user';
}

function isOwner(actor, services) {
  return resolveActorRole(actor, services) === 'owner';
}

function isAdmin(actor, services) {
  const role = resolveActorRole(actor, services);
  return role === 'owner' || role === 'admin';
}

function hasWorkspacePermission(actor, workspaceId, permission, services) {
  if (isOwner(actor, services)) return true;
  if (!actor || !workspaceId) return false;

  const actorWorkspaces = actor.workspaces || actor.workspaceIds || [];
  if (!Array.isArray(actorWorkspaces) || !actorWorkspaces.includes(workspaceId)) return false;

  if (permission === 'read') return true;
  if (permission === 'write' && isAdmin(actor, services)) return true;

  return false;
}

function checkGovernancePermission(action, actor, context, services) {
  const role = resolveActorRole(actor, services);
  const capability = (context && context.capability) || {};
  const requiresOwner = capability.requiresOwner || false;
  const requiresAdmin = capability.requiresAdmin || false;

  const reasons = [];
  let allowed = true;

  if (requiresOwner && role !== 'owner') {
    allowed = false;
    reasons.push('OWNER_REQUIRED');
  } else if (requiresAdmin && !isAdmin(actor, services)) {
    allowed = false;
    reasons.push('ADMIN_REQUIRED');
  }

  const sensitiveModules = ['lifeos', 'memory', 'knowledge'];
  if (sensitiveModules.includes(capability.module) && context.privateScope && role !== 'owner') {
    allowed = false;
    reasons.push('PRIVATE_SCOPE_REQUIRES_OWNER');
  }

  return {
    allowed,
    role,
    reasons,
    actorId: String(actor && (actor.id || actor.userId || actor.chatId || '')).slice(0, 20),
    checkType: 'governance_permission'
  };
}

function buildPermissionDecision(action, actor, context) {
  const role = resolveActorRole(actor, {});
  const actionType = (action && action.actionType) || 'read';

  const safeActions = ['read', 'report', 'plan', 'dry_run'];
  const canDirectRun = safeActions.includes(actionType);

  return {
    actorId: String(actor && (actor.id || actor.userId || actor.chatId || '')).slice(0, 20),
    role,
    action: action ? action.name || action.action || '' : '',
    actionType,
    canDirectRun,
    requiresAdmin: !canDirectRun && role !== 'owner' && role !== 'admin',
    timestamp: new Date().toISOString()
  };
}

module.exports = {
  resolveActorRole,
  isOwner,
  isAdmin,
  hasWorkspacePermission,
  checkGovernancePermission,
  buildPermissionDecision
};

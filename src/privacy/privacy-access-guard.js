'use strict';

function checkPrivacyAccess(actor, dataRequest) {
  if (!actor || !actor.role) return { allowed: false, reason: 'Unknown actor', status: 'denied' };
  if (actor.role === 'owner') return { allowed: true, reason: 'Owner access granted', status: 'allowed' };
  if (dataRequest?.ownerOnly && actor.role !== 'owner') return { allowed: false, reason: 'Owner-only data', status: 'denied' };
  if (actor.role === 'admin') return { allowed: true, reason: 'Admin access granted', status: 'allowed' };
  if (actor.role === 'user' && dataRequest?.allowedRoles?.includes('user')) return { allowed: true, reason: 'User access granted', status: 'allowed' };
  return { allowed: false, reason: `Role ${actor.role} not authorized`, status: 'denied' };
}

function checkExportAccess(actor, exportRequest) {
  if (!actor) return { allowed: false, reason: 'Unknown actor', status: 'denied' };
  if (exportRequest?.ownerOnly && actor.role !== 'owner') return { allowed: false, reason: 'Owner-only export', status: 'denied' };
  if (exportRequest?.includeSensitive && actor.role !== 'owner') return { allowed: false, reason: 'Sensitive export requires owner', status: 'denied' };
  return { allowed: true, reason: 'Export access granted', status: 'allowed' };
}

function checkArchiveAccess(actor, archiveRequest) {
  if (!actor) return { allowed: false, reason: 'Unknown actor', status: 'denied' };
  if (actor.role === 'owner' || actor.role === 'admin') return { allowed: true, reason: 'Archive access granted', status: 'allowed' };
  return { allowed: false, reason: 'Archive requires admin/owner', status: 'denied' };
}

function checkDeleteAccess(actor, deleteRequest) {
  if (!actor) return { allowed: false, reason: 'Unknown actor', status: 'denied' };
  if (actor.role === 'owner') return { allowed: true, reason: 'Owner delete access granted', status: 'allowed' };
  if (actor.role === 'admin' && !deleteRequest?.hardDeleteRequested) return { allowed: true, reason: 'Admin soft delete granted', status: 'allowed' };
  if (deleteRequest?.hardDeleteRequested && actor.role !== 'owner') return { allowed: false, reason: 'Hard delete requires owner', status: 'denied' };
  return { allowed: false, reason: 'Delete access denied', status: 'denied' };
}

function buildPrivacyAccessDeniedResponse(reason) {
  return { ok: false, error: 'PRIVACY_ACCESS_DENIED', message: reason || 'Access denied by privacy policy' };
}

module.exports = { checkPrivacyAccess, checkExportAccess, checkArchiveAccess, checkDeleteAccess, buildPrivacyAccessDeniedResponse };

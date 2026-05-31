'use strict';

function actor(meta = {}) {
  return meta.actorId || meta.actor || 'dashboard-admin';
}

function nowIso() {
  return new Date().toISOString();
}

function applySoftDelete(item = {}, meta = {}) {
  const now = meta.now || nowIso();
  return {
    ...item,
    archivedAt: item.archivedAt || now,
    archivedBy: item.archivedBy || actor(meta),
    archiveReason: meta.reason || item.archiveReason || '',
    deletedAt: item.deletedAt || now,
    deletedBy: item.deletedBy || actor(meta),
    deleteReason: meta.reason || item.deleteReason || '',
    restoredAt: null,
    restoredBy: null,
    status: item.status === 'completed' ? item.status : (meta.status || item.status || 'archived')
  };
}

function restoreSoftDeleted(item = {}, meta = {}) {
  const now = meta.now || nowIso();
  const next = { ...item };
  delete next.deletedAt;
  delete next.deletedBy;
  delete next.deleteReason;
  delete next.deleted_at;
  next.archivedAt = null;
  next.archivedBy = null;
  next.archiveReason = null;
  next.restoredAt = now;
  next.restoredBy = actor(meta);
  if (next.status === 'archived') next.status = meta.status || 'active';
  return next;
}

function isSoftDeleted(item = {}) {
  return Boolean(item.deletedAt || item.deleted_at || item.archivedAt || item.archived_at || item.status === 'archived');
}

function buildSoftDeleteSummary(item = {}) {
  return {
    id: item.id,
    status: item.status || 'archived',
    archivedAt: item.archivedAt || item.deletedAt || item.deleted_at || null,
    reason: item.archiveReason || item.deleteReason || ''
  };
}

function buildRestoreSummary(item = {}) {
  return {
    id: item.id,
    status: item.status || 'active',
    restoredAt: item.restoredAt || null
  };
}

module.exports = {
  applySoftDelete,
  buildRestoreSummary,
  buildSoftDeleteSummary,
  isSoftDeleted,
  restoreSoftDeleted
};

'use strict';

const store = require('./backup-store');
const utils = require('./backup-utils');

async function detectBackupStaleness(services = {}) {
  const backups = await store.listBackupItems(utils.BACKUP_MANIFESTS_KEY, { limit: 5, includeArchived: true }, services);
  const latest = backups[0] || null;
  const ageMs = latest?.createdAt ? Date.now() - new Date(latest.createdAt).getTime() : null;
  return {
    latestBackupId: latest?.id || '',
    latestBackupAt: latest?.createdAt || null,
    backupCount: backups.length,
    stale: ageMs === null || ageMs > 7 * 24 * 60 * 60 * 1000,
    ageHours: ageMs === null ? null : Math.round(ageMs / 36e5)
  };
}

function detectStorageRisk(services = {}) {
  const status = store.getBackupStorageStatus(services);
  const risks = [];
  if (status.activeDriver !== 'postgres') risks.push('Storage utama bukan PostgreSQL; pastikan JSON fallback ikut dibackup.');
  if (status.fallbackActive) risks.push(`Fallback aktif: ${status.fallbackReason || 'unknown'}`);
  if (!status.redisAvailable) risks.push('Redis tidak tersedia; cache/session memakai fallback.');
  return { ...status, risks };
}

async function detectMissingCriticalData(services = {}) {
  const keys = ['workspaces', 'backup_manifests', 'dashboard_audit_logs'];
  const missing = [];
  for (const key of keys) {
    const value = services.storageManager?.safeRead ? await services.storageManager.safeRead(key, []) : [];
    if (utils.countItems(value) === 0) missing.push(key);
  }
  return { missing, ok: missing.length === 0 };
}

async function getDisasterRecoveryStatus(services = {}) {
  const [backup, storage, critical] = await Promise.all([
    detectBackupStaleness(services),
    Promise.resolve(detectStorageRisk(services)),
    detectMissingCriticalData(services)
  ]);
  const status = backup.stale || storage.risks.length || !critical.ok ? 'attention' : 'ready';
  return utils.sanitize({ status, backup, storage, critical });
}

function buildRecoveryRecommendations(status = {}) {
  const recommendations = [];
  if (status.backup?.stale) recommendations.push('Buat backup workspace atau full_safe terbaru.');
  if (status.storage?.activeDriver !== 'postgres') recommendations.push('Aktifkan PostgreSQL sebagai active storage jika DATABASE_URL sudah sehat.');
  if (status.storage?.fallbackActive) recommendations.push('Periksa fallbackReason storage dan pastikan data JSON ikut disimpan.');
  if (status.critical?.missing?.includes('dashboard_audit_logs')) recommendations.push('Audit log masih kosong; jalankan action kecil untuk memastikan audit tersedia.');
  if (!recommendations.length) recommendations.push('Recovery posture sehat. Lanjutkan backup berkala.');
  return recommendations;
}

async function runDisasterRecoveryCheck(services = {}) {
  const status = await getDisasterRecoveryStatus(services);
  return {
    ok: true,
    status,
    recommendations: buildRecoveryRecommendations(status),
    checkedAt: utils.nowIso()
  };
}

module.exports = {
  buildRecoveryRecommendations,
  detectBackupStaleness,
  detectMissingCriticalData,
  detectStorageRisk,
  getDisasterRecoveryStatus,
  runDisasterRecoveryCheck
};

'use strict';

const utils = require('./release-utils');

let freezeActive = false;
let freezeStartTime = null;
let freezeReport = null;

function startReleaseFreeze(input = {}, services = {}) {
  if (freezeActive) {
    return { ok: false, error: 'Release freeze is already active', freezeActive: true };
  }
  freezeActive = true;
  freezeStartTime = utils.formatTimestamp();
  freezeReport = {
    freezeActive: true,
    startedAt: freezeStartTime,
    startedBy: input.startedBy || 'system',
    reason: input.reason || 'Phase 50 Release Candidate preparation',
    allowedChanges: ['P0', 'P1', 'docs', 'test', 'security', 'privacy', 'dashboard_fix', 'boot_fix', 'deploy_fix', 'report'],
    blockedChanges: ['new_major_feature', 'new_module', 'large_refactor', 'breaking_change'],
    featureWorkDetected: [],
    p0PatchesApproved: [],
    p0PatchesRejected: [],
    createdAt: utils.formatTimestamp()
  };
  return { ok: true, freezeReport };
}

function getReleaseFreezeStatus(services = {}) {
  return {
    freezeActive,
    startedAt: freezeStartTime,
    report: freezeReport || null,
    timestamp: utils.formatTimestamp()
  };
}

function detectFeatureWorkDuringFreeze(services = {}) {
  const detected = [];
  const env = services.env || process.env || {};
  const features = env.FEATURE_FLAGS || '';
  if (features) {
    const flags = String(features).split(',').map(f => f.trim()).filter(Boolean);
    for (const flag of flags) {
      if (!/^(docs|test|fix|patch|security|privacy|report)/i.test(flag)) {
        detected.push({ flag, reason: 'Non-allowed feature flag during freeze' });
      }
    }
  }
  if (freezeReport) {
    freezeReport.featureWorkDetected = detected;
  }
  return detected;
}

function allowOnlyP0Patch(change = {}, services = {}) {
  if (!freezeActive) {
    return { ok: false, error: 'Freeze is not active', allowed: false };
  }
  const changeType = String(change.type || '').toLowerCase();
  const allowed = ['p0', 'p1', 'docs', 'test', 'security', 'privacy', 'dashboard_fix', 'boot_fix', 'deploy_fix', 'report'];
  if (allowed.includes(changeType)) {
    if (freezeReport) {
      freezeReport.p0PatchesApproved.push({
        type: changeType,
        description: change.description || '',
        approvedAt: utils.formatTimestamp()
      });
    }
    return { ok: true, allowed: true, message: 'Change allowed during freeze' };
  }
  if (freezeReport) {
    freezeReport.p0PatchesRejected.push({
      type: changeType,
      description: change.description || '',
      rejectedAt: utils.formatTimestamp(),
      reason: 'Not allowed during release freeze'
    });
  }
  return { ok: false, allowed: false, message: 'Change blocked by release freeze. Allowed: P0/P1 fixes, docs, tests, security, privacy, dashboard/boot/deploy fixes.' };
}

function endReleaseFreeze(services = {}) {
  if (!freezeActive) {
    return { ok: false, error: 'No active freeze to end' };
  }
  freezeActive = false;
  if (freezeReport) {
    freezeReport.endedAt = utils.formatTimestamp();
    freezeReport.freezeActive = false;
  }
  return { ok: true, freezeReport };
}

function buildReleaseFreezeReport(services = {}) {
  return freezeReport || {
    freezeActive: false,
    message: 'No release freeze has been started',
    timestamp: utils.formatTimestamp()
  };
}

module.exports = {
  startReleaseFreeze,
  getReleaseFreezeStatus,
  detectFeatureWorkDuringFreeze,
  allowOnlyP0Patch,
  endReleaseFreeze,
  buildReleaseFreezeReport
};

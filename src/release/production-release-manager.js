'use strict';

const prodStore = require('./production-release-store');
const RcStabilizationAuditor = require('./rc-stabilization-auditor');
const RcBlockerClassifier = require('./rc-blocker-classifier');

const ProductionReleaseManager = {
  createProductionRelease(input = {}, services = {}) {
    const release = prodStore.createProductionRelease(input);
    return release;
  },

  verifyRcReadyForProduction(services = {}) {
    const audit = RcStabilizationAuditor.runRcStabilizationAudit(services);
    const summary = RcBlockerClassifier.buildRcBlockerSummary(audit.p0Findings.concat(audit.p1Findings));
    return { ready: summary.blocked === false && summary.p0Count === 0, audit, blockerSummary: summary };
  },

  finalizeProductionReleasePlan(releaseId, services = {}) {
    const release = prodStore.getProductionRelease(releaseId);
    if (!release) return { ok: false, error: 'Release not found' };
    const verification = this.verifyRcReadyForProduction(services);
    const env = services.env || process.env;

    const findings = [];
    if (!verification.ready) findings.push({ severity: 'P0', message: 'RC not ready for production' });
    if (env.AUTO_APPROVE_ENABLED === 'true') findings.push({ severity: 'P0', message: 'AUTO_APPROVE_ENABLED is true' });
    if (env.AUTO_RUN_ENABLED === 'true') findings.push({ severity: 'P0', message: 'AUTO_RUN_ENABLED is true' });
    if (env.SHELL_EXECUTOR_ENABLED === 'true') findings.push({ severity: 'P0', message: 'SHELL_EXECUTOR_ENABLED is true' });
    if (!env.TELEGRAM_TOKEN) findings.push({ severity: 'P0', message: 'TELEGRAM_TOKEN not configured' });

    const p0 = findings.filter(f => f.severity === 'P0');
    const p1 = findings.filter(f => f.severity === 'P1');
    if (p0.length > 0 || !verification.ready) {
      prodStore.updateProductionRelease(releaseId, { status: 'blocked', blockers: p0.map(f => f.message), warnings: p1.map(f => f.message) });
      return { ok: false, status: 'blocked', blockers: p0, warnings: p1, release: prodStore.getProductionRelease(releaseId) };
    }

    prodStore.updateProductionRelease(releaseId, { status: 'ready', releaseReadinessStatus: 'ready' });
    return { ok: true, status: 'ready', release: prodStore.getProductionRelease(releaseId) };
  },

  blockReleaseIfP0Exists(releaseId, services = {}) {
    const release = prodStore.getProductionRelease(releaseId);
    if (!release) return { ok: false, error: 'Release not found' };
    const env = services.env || process.env;
    const blockers = [];
    if (env.AUTO_APPROVE_ENABLED === 'true') blockers.push('AUTO_APPROVE_ENABLED is true');
    if (env.AUTO_RUN_ENABLED === 'true') blockers.push('AUTO_RUN_ENABLED is true');
    if (env.SHELL_EXECUTOR_ENABLED === 'true') blockers.push('SHELL_EXECUTOR_ENABLED is true');
    if (!env.TELEGRAM_TOKEN) blockers.push('TELEGRAM_TOKEN not configured');
    if (blockers.length > 0) {
      prodStore.updateProductionRelease(releaseId, { status: 'blocked', blockers: release.blockers.concat(blockers) });
      return { ok: false, blocked: true, blockers };
    }
    return { ok: true, blocked: false };
  },

  buildProductionReleaseSummary(releaseId, services = {}) {
    const release = prodStore.getProductionRelease(releaseId);
    if (!release) return { ok: false, error: 'Release not found' };
    const audit = RcStabilizationAuditor.runRcStabilizationAudit(services);
    return {
      ok: true,
      release: prodStore.sanitize(release),
      rcAuditStatus: audit.status,
      totalFindings: audit.summary.totalFindings,
      p0Count: audit.summary.p0,
      p1Count: audit.summary.p1
    };
  }
};

module.exports = ProductionReleaseManager;

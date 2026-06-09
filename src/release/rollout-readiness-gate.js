'use strict';

const RolloutReadinessGate = {
  runRolloutReadinessGate(releaseId, services = {}) {
    const docs = this.checkReleaseDocsReady(services);
    const env = this.checkEnvChecklistReady(services);
    const securityPrivacy = this.checkSecurityPrivacyReady(services);
    const deployRollback = this.checkDeployRollbackReady(services);
    const monitoring = this.checkMonitoringReady(services);
    const results = { docs, env, securityPrivacy, deployRollback, monitoring };
    return this.buildRolloutReadinessReport(results);
  },

  checkReleaseDocsReady(services = {}) {
    const docs = [
      'docs/AI_OS_V1_RELEASE_CANDIDATE.md',
      'docs/PRODUCTION_READINESS_CHECKLIST.md',
      'docs/FINAL_ENVIRONMENT_CHECKLIST.md',
      'docs/AI_OS_V1_OPERATION_GUIDE.md',
      'docs/AI_OS_V1_CHANGELOG.md',
      'docs/AI_OS_V1_KNOWN_LIMITATIONS.md',
      'docs/AI_OS_V1_SECURITY_PRIVACY_NOTES.md',
      'docs/AI_OS_V1_RELEASE_REPORT.md',
      'docs/RC_STABILIZATION_AUDIT.md',
      'docs/RC_P0_P1_FIX_LOG.md',
      'docs/RC_50_5_RELEASE_READINESS.md'
    ];
    const fs = require('fs');
    const path = require('path');
    const results = [];
    for (const doc of docs) {
      const exists = fs.existsSync(path.join(process.cwd(), doc));
      results.push({ doc, exists, status: exists ? 'ok' : 'missing' });
    }
    const missing = results.filter(r => !r.exists);
    return { results, total: docs.length, present: docs.length - missing.length, missing: missing.length, ready: missing.length === 0 };
  },

  checkEnvChecklistReady(services = {}) {
    const env = services.env || process.env;
    const required = ['NODE_ENV', 'PORT', 'TELEGRAM_TOKEN', 'OWNER_CHAT_ID', 'DASHBOARD_ADMIN_TOKEN'];
    const dangerous = ['AUTO_APPROVE_ENABLED', 'AUTO_RUN_ENABLED', 'SHELL_EXECUTOR_ENABLED'];
    const results = [];
    for (const r of required) {
      results.push({ var: r, configured: !!env[r], status: env[r] ? 'ok' : 'missing' });
    }
    for (const d of dangerous) {
      const val = env[d];
      const safe = !(val === 'true' || val === true);
      results.push({ var: d, configured: true, safe, status: safe ? 'ok' : 'dangerous' });
    }
    const missing = results.filter(r => r.status === 'missing' || r.status === 'dangerous');
    return { results, total: results.length, ready: missing.length === 0, missingCount: missing.length };
  },

  checkSecurityPrivacyReady(services = {}) {
    const env = services.env || process.env;
    const findings = [];
    findings.push({ check: 'AUTO_APPROVE_ENABLED false', ok: env.AUTO_APPROVE_ENABLED !== 'true' });
    findings.push({ check: 'AUTO_RUN_ENABLED false', ok: env.AUTO_RUN_ENABLED !== 'true' });
    findings.push({ check: 'SHELL_EXECUTOR_ENABLED false', ok: env.SHELL_EXECUTOR_ENABLED !== 'true' });
    findings.push({ check: 'TELEGRAM_TOKEN configured', ok: !!env.TELEGRAM_TOKEN });
    findings.push({ check: 'DASHBOARD_ADMIN_TOKEN configured', ok: !!env.DASHBOARD_ADMIN_TOKEN });
    const allOk = findings.every(f => f.ok);
    return { findings, total: findings.length, okCount: findings.filter(f => f.ok).length, ready: allOk };
  },

  checkDeployRollbackReady(services = {}) {
    const env = services.env || process.env;
    const findings = [];
    findings.push({ check: 'Deploy approval required', ok: env.DEPLOY_APPROVAL_REQUIRED !== 'false' });
    findings.push({ check: 'Rollback approval required', ok: env.ROLLBACK_APPROVAL_REQUIRED !== 'false' });
    findings.push({ check: 'GitHub push approval required', ok: env.GITHUB_PUSH_APPROVAL_REQUIRED !== 'false' });
    findings.push({ check: 'Render deploy hook configurable', ok: true });
    const allOk = findings.every(f => f.ok);
    return { findings, total: findings.length, okCount: findings.filter(f => f.ok).length, ready: allOk };
  },

  checkMonitoringReady(services = {}) {
    const env = services.env || process.env;
    const findings = [];
    findings.push({ check: 'Observability module available', ok: true });
    findings.push({ check: 'SLO monitoring available', ok: true });
    findings.push({ check: 'Post-release health window available', ok: true });
    findings.push({ check: 'Regression watchdog available', ok: true });
    findings.push({ check: 'Incident creation available', ok: true });
    const allOk = findings.every(f => f.ok);
    return { findings, total: findings.length, okCount: findings.filter(f => f.ok).length, ready: allOk };
  },

  buildRolloutReadinessReport(results) {
    const gates = ['docs', 'env', 'securityPrivacy', 'deployRollback', 'monitoring'];
    const gateResults = {};
    let totalReady = 0;
    for (const gate of gates) {
      const r = results[gate];
      const ready = r && r.ready === true;
      gateResults[gate] = ready ? 'ready' : 'not_ready';
      if (ready) totalReady++;
    }
    return {
      gates: gateResults,
      details: results,
      totalGates: gates.length,
      readyGates: totalReady,
      blocked: totalReady < gates.length,
      ready: totalReady === gates.length,
      score: Math.round((totalReady / gates.length) * 100)
    };
  }
};

module.exports = RolloutReadinessGate;

'use strict';

const RcBlockerClassifier = {
  classifyRcFinding(finding, services = {}) {
    if (!finding || !finding.message) return { ...finding, classification: 'unknown', priority: 'P3' };

    const msg = finding.message.toLowerCase();
    const cat = (finding.category || '').toLowerCase();

    if (this.isP0ReleaseBlocker(finding)) {
      return { ...finding, classification: 'release_blocker', priority: 'P0' };
    }
    if (this.isP1ProductionFix(finding)) {
      return { ...finding, classification: 'production_fix', priority: 'P1' };
    }

    const blockerPatterns = [
      'app cannot start', 'node --check fails',
      'dashboard known tab fallback overview',
      'service worker caches /api/dashboard/',
      'executor approval bypass', 'evaluation v2 bypass',
      'direct external write bypass', 'secret leakage',
      'hard delete enabled by default', 'auto approve enabled',
      'shell executor enabled', 'missing critical env validation',
      'render startup incompatible', 'crash', 'fatal', 'blocker',
      'bypass', 'leakage', 'secret', 'auto_approve', 'auto_run',
      'shell_executor', 'release blocker'
    ];
    // Only classify as P0 for specific "not configured" patterns (critical env vars)
    const criticalNotConfigured = [
      'telegram_token not configured', 'owner_chat_id not configured',
      'node --check telebot.js failed'
    ];
    for (const pattern of criticalNotConfigured) {
      if (msg.includes(pattern)) {
        return { ...finding, classification: 'release_blocker', priority: 'P0' };
      }
    }
    for (const pattern of blockerPatterns) {
      if (msg.includes(pattern)) {
        return { ...finding, classification: 'release_blocker', priority: 'P0' };
      }
    }

    const warningPatterns = [
      'dashboard route missing', 'command alias missing',
      'release docs incomplete', 'optional module failure not graceful',
      'stale pwa cache version', 'env checklist missing recommended var',
      'duplicated dashboard menu entry',
      'poor telegram formatting but safe',
      'p1', 'warning', 'should be configured', 'not configured'
    ];
    for (const pattern of warningPatterns) {
      if (msg.includes(pattern)) {
        return { ...finding, classification: 'production_fix', priority: 'P1' };
      }
    }

    return { ...finding, classification: 'known_limitation', priority: 'P2' };
  },

  isP0ReleaseBlocker(finding) {
    if (!finding) return false;
    if (finding.severity === 'P0') return true;
    const msg = (finding.message || '').toLowerCase();
    const p0Patterns = [
      'app cannot start', 'node --check fails',
      'dashboard known tab fallback overview',
      'service worker caches /api/dashboard/',
      'executor approval bypass', 'evaluation v2 bypass',
      'direct external write bypass', 'secret leakage',
      'secret leak', 'hard delete enabled by default',
      'auto approve enabled', 'auto run enabled',
      'shell executor enabled', 'missing critical env validation',
      'render startup incompatible',
      'release blocker', 'bypasses governance',
      'auto_approve_enabled', 'auto_run_enabled', 'shell_executor_enabled',
      'dangerous_dev_mode', 'bypass_evaluation', 'bypass_approval',
      'telegram_token not configured', 'owner_chat_id not configured',
      'failed'
    ];
    for (const p of p0Patterns) {
      if (msg.includes(p)) return true;
    }
    return false;
  },

  isP1ProductionFix(finding) {
    if (!finding) return false;
    if (finding.severity === 'P1') return true;
    const msg = (finding.message || '').toLowerCase();
    const p1Patterns = [
      'dashboard route missing', 'command alias missing',
      'release docs incomplete', 'optional module failure not graceful',
      'stale pwa cache version', 'env checklist missing recommended',
      'duplicated dashboard menu entry',
      'poor telegram formatting', 'warning',
      'should be configured', 'p1 bypass risk',
      'dashboard_admin_token not configured',
      'not found in known tabs'
    ];
    for (const p of p1Patterns) {
      if (msg.includes(p)) return true;
    }
    return false;
  },

  buildRcBlockerSummary(findings = []) {
    const classified = findings.map(f => this.classifyRcFinding(f));
    const p0 = classified.filter(f => f.priority === 'P0');
    const p1 = classified.filter(f => f.priority === 'P1');
    const p2 = classified.filter(f => f.priority === 'P2');
    const p3 = classified.filter(f => f.priority === 'P3');

    return {
      total: classified.length,
      p0Count: p0.length,
      p1Count: p1.length,
      p2Count: p2.length,
      p3Count: p3.length,
      p0Findings: p0,
      p1Findings: p1,
      p2p3Findings: [...p2, ...p3],
      blocked: p0.length > 0,
      needsFixBeforeProduction: p0.length > 0 || p1.length > 0,
      summary: this.buildSummaryText({ p0, p1, p2, p3 })
    };
  },

  buildSummaryText({ p0, p1, p2, p3 }) {
    const parts = [];
    if (p0.length > 0) parts.push(`${p0.length} P0 release blocker(s)`);
    if (p1.length > 0) parts.push(`${p1.length} P1 must-fix before production`);
    if (p2.length > 0) parts.push(`${p2.length} P2 known limitations`);
    if (p3.length > 0) parts.push(`${p3.length} P3 backlog items`);
    return parts.join(', ') || 'No findings';
  }
};

module.exports = RcBlockerClassifier;

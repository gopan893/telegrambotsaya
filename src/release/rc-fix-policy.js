'use strict';

const RcFixPolicy = {
  evaluateRcFixAllowed(change = {}, services = {}) {
    if (!change || !change.type) {
      return { allowed: false, reason: 'No change type specified' };
    }

    const typeCheck = this.assertNoLargeFeatureChange(change, services);
    if (!typeCheck.allowed) return typeCheck;

    const unsafeCheck = this.assertNoUnsafeCapabilityAdded(change, services);
    if (!unsafeCheck.allowed) return unsafeCheck;

    const fixCheck = this.assertFixIsP0OrP1(change, services);
    if (!fixCheck.allowed) return fixCheck;

    return this.buildRcFixPolicyDecision({ ...change, allowed: true, classification: fixCheck.classification });
  },

  assertNoLargeFeatureChange(change = {}, services = {}) {
    const type = (change.type || '').toLowerCase();
    const desc = (change.description || '').toLowerCase();
    const blockedTypes = ['new_feature', 'new_module', 'large_refactor', 'new_agent', 'new_connector', 'new_automation'];
    const blockedPatterns = [
      'new agent', 'new connector', 'new automation', 'new external write',
      'new shell', 'new deploy', 'new push', 'new release',
      'large refactor', 'new storage', 'new dashboard admin',
      'create module', 'create agent', 'create connector'
    ];
    if (blockedTypes.includes(type)) {
      return { allowed: false, reason: `Large feature/refactor blocked by release freeze: ${type}` };
    }
    for (const pattern of blockedPatterns) {
      if (desc.includes(pattern)) {
        return { allowed: false, reason: `Change blocked by release freeze: ${pattern}` };
      }
    }
    return { allowed: true };
  },

  assertNoUnsafeCapabilityAdded(change = {}, services = {}) {
    const desc = (change.description || '').toLowerCase();
    const unsafePatterns = [
      'shell executor', 'shell_executor', 'auto approve', 'auto_approve',
      'auto run', 'auto_run', 'direct github push', 'direct deploy',
      'direct release', 'direct tag', 'direct workflow',
      'webhook write', 'gmail send', 'calendar write',
      'direct hard delete', 'bypass evaluation', 'bypass approval',
      'secret exposure', 'token exposure', 'raw secret',
      'env value exposure', 'credential rotation auto'
    ];
    for (const pattern of unsafePatterns) {
      if (desc.includes(pattern)) {
        return { allowed: false, reason: `Unsafe capability blocked: ${pattern}` };
      }
    }
    return { allowed: true };
  },

  assertFixIsP0OrP1(change = {}, services = {}) {
    const priority = (change.priority || '').toUpperCase();
    const desc = (change.description || '').toLowerCase();
    const p0Patterns = [
      'boot crash', 'syntax', 'import', 'startup', 'fatal', 'crash',
      'blocker', 'release blocker', 'dashboard fallback overview',
      'service worker cache', 'approval bypass', 'evaluation bypass',
      'secret leak', 'secret leakage', 'hard delete enabled',
      'auto approve', 'auto run', 'shell executor',
      'env validation', 'render startup'
    ];
    const p1Patterns = [
      'dashboard route missing', 'command alias missing',
      'docs incomplete', 'optional module fallback',
      'stale cache', 'env checklist missing', 'duplicated menu',
      'telegram formatting', 'missing fallback', 'typo',
      'dashboard sidebar', 'registry mismatch', 'renderer alias',
      'pwa cache', 'test fix', 'failing test'
    ];
    if (priority === 'P0') {
      return { allowed: true, classification: 'P0' };
    }
    if (priority === 'P1') {
      return { allowed: true, classification: 'P1' };
    }
    for (const p of p0Patterns) {
      if (desc.includes(p)) return { allowed: true, classification: 'P0' };
    }
    for (const p of p1Patterns) {
      if (desc.includes(p)) return { allowed: true, classification: 'P1' };
    }
    if (['docs', 'docs_update', 'test', 'test_update', 'report'].includes(change.type)) {
      return { allowed: true, classification: 'P2' };
    }
    return { allowed: false, reason: `Change is P2/P3: ${change.description || 'unknown'}` };
  },

  buildRcFixPolicyDecision(change = {}) {
    return {
      allowed: change.allowed !== false,
      change: {
        type: change.type || 'unknown',
        description: change.description || '',
        priority: change.classification || change.priority || 'P2'
      },
      reason: change.reason || (change.allowed !== false ? 'Fix allowed by RC fix policy' : 'Fix blocked by RC fix policy'),
      policy: 'rc-stabilization-fix-policy-v1',
      timestamp: new Date().toISOString()
    };
  }
};

module.exports = RcFixPolicy;

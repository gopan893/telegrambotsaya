'use strict';

const pp = require('../../src/privacy/privacy-policy-engine');

describe('Privacy Policy Engine', () => {
  describe('getPrivacyPolicy', () => {
    test('returns default for unknown category', () => {
      const policy = pp.getPrivacyPolicy('nonexistent_category');
      expect(policy.allowedRoles).toContain('user');
      expect(policy.allowExport).toBe(true);
    });

    test('lifeos_mood_energy is owner-only', () => {
      const policy = pp.getPrivacyPolicy('lifeos_mood_energy');
      expect(policy.ownerOnly).toBe(true);
      expect(policy.allowedRoles).toEqual(['owner']);
      expect(policy.allowDashboardAccess).toBe(false);
    });

    test('telegram_messages allows admin access', () => {
      const policy = pp.getPrivacyPolicy('telegram_messages');
      expect(policy.allowedRoles).toContain('admin');
      expect(policy.allowAgentAccess).toBe(true);
    });
  });

  describe('updatePrivacyPolicy', () => {
    test('creates new policy', () => {
      const newPolicy = pp.updatePrivacyPolicy({ dataCategory: 'test_category', allowedRoles: ['owner'] });
      expect(newPolicy.id).toBeTruthy();
      expect(newPolicy.dataCategory).toBe('test_category');
      expect(newPolicy.createdAt).toBeTruthy();
    });
  });

  describe('evaluatePrivacyAccess', () => {
    test('blocks admin for owner-only data', () => {
      const result = pp.evaluatePrivacyAccess({
        actor: { role: 'admin' }, dataCategory: 'lifeos_mood_energy', action: 'view'
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Owner-only data');
    });

    test('allows owner for owner-only data', () => {
      const result = pp.evaluatePrivacyAccess({
        actor: { role: 'owner' }, dataCategory: 'lifeos_mood_energy', action: 'view'
      });
      expect(result.allowed).toBe(true);
    });

    test('blocks export for non-exportable category', () => {
      const result = pp.evaluatePrivacyAccess({
        actor: { role: 'owner' }, dataCategory: 'lifeos_mood_energy', action: 'export'
      });
      expect(result.allowed).toBe(false);
    });

    test('allows admin for telegram_messages view', () => {
      const result = pp.evaluatePrivacyAccess({
        actor: { role: 'admin' }, dataCategory: 'telegram_messages', action: 'view'
      });
      expect(result.allowed).toBe(true);
    });
  });

  describe('buildPrivacyDecision', () => {
    test('returns correct format', () => {
      const decision = pp.buildPrivacyDecision({
        actor: { role: 'owner' }, dataCategory: 'telegram_messages', action: 'view'
      });
      expect(decision.request).toBeTruthy();
      expect(decision.request.actor).toBe('owner');
      expect(decision.allowed).toBe(true);
      expect(decision.timestamp).toBeTruthy();
    });
  });

  describe('listPolicies', () => {
    test('returns array with at least one policy after update', () => {
      pp.updatePrivacyPolicy({ dataCategory: 'test_category', allowedRoles: ['owner'] });
      const policies = pp.listPolicies();
      expect(Array.isArray(policies)).toBe(true);
      expect(policies.length).toBeGreaterThanOrEqual(1);
    });
  });
});

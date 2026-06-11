'use strict';

const scorecard = require('../../src/security/security-scorecard');

describe('Security Scorecard', () => {
  describe('calculateSecurityScorecard', () => {
    test('empty findings returns 100 for all scores', () => {
      const sc = scorecard.calculateSecurityScorecard({});
      expect(typeof sc.overallScore).toBe('number');
      expect(sc.secretScore).toBe(100);
      expect(sc.envScore).toBe(100);
      expect(sc.approvalSafetyScore).toBe(100);
    });

    test('has all required fields', () => {
      const sc = scorecard.calculateSecurityScorecard({});
      expect(sc.id).toBeTruthy();
      expect(sc.recommendations).toBeTruthy();
      expect(Array.isArray(sc.recommendations)).toBe(true);
    });
  });

  describe('calculateSecretScore', () => {
    test('critical findings reduce secret score', () => {
      const result = { findings: [{ severity: 'critical' }, { severity: 'critical' }, { severity: 'high' }] };
      const sc = scorecard.calculateSecretScore(result);
      expect(sc).toBeLessThan(100);
      expect(sc).toBeGreaterThanOrEqual(0);
      expect(sc).toBe(62);
    });

    test('null returns 100', () => {
      expect(scorecard.calculateSecretScore(null)).toBe(100);
    });
  });

  describe('calculateApprovalSafetyScore', () => {
    test('all blocked returns 100', () => {
      const result = { findings: [{ directExecutionBlocked: true }, { directExecutionBlocked: true }] };
      expect(scorecard.calculateApprovalSafetyScore(result)).toBe(100);
    });

    test('not all blocked returns 30', () => {
      const result = { findings: [{ directExecutionBlocked: true }, { directExecutionBlocked: false }] };
      expect(scorecard.calculateApprovalSafetyScore(result)).toBe(30);
    });

    test('null returns 100', () => {
      expect(scorecard.calculateApprovalSafetyScore(null)).toBe(100);
    });
  });

  describe('buildSecurityScoreExplanation', () => {
    test('returns formatted text with all sections', () => {
      const sc = scorecard.calculateSecurityScorecard({});
      const expl = scorecard.buildSecurityScoreExplanation(sc);
      expect(typeof expl).toBe('string');
      expect(expl).toContain('Overall:');
      expect(expl).toContain('Secret Score:');
      expect(expl).toContain('Recommendations:');
    });

    test('null returns string', () => {
      expect(typeof scorecard.buildSecurityScoreExplanation(null)).toBe('string');
    });
  });

  describe('calculateEnvScore', () => {
    test('issues reduce env score', () => {
      const result = { issues: [{ severity: 'critical' }, { severity: 'high' }] };
      const sc = scorecard.calculateEnvScore(result);
      expect(sc).toBeLessThan(100);
    });
  });
});

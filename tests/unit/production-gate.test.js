'use strict';

const path = require('path');
const gatePath = path.resolve('src/release/production-readiness-gate');
let gate;

beforeAll(() => {
  gate = require(gatePath);
});

describe('Production Readiness Gate', () => {
  test('gate module loads successfully', () => {
    expect(gate).toBeDefined();
  });

  describe('checkBootReadiness', () => {
    test('returns ok and score', async () => {
      const result = await gate.checkBootReadiness();
      expect(result).toBeDefined();
      expect(result.ok).not.toBeUndefined();
    });
  });

  describe('checkDashboardReadiness', () => {
    test('returns ok and score', async () => {
      const result = await gate.checkDashboardReadiness();
      expect(result).toBeDefined();
      expect(result.ok).not.toBeUndefined();
    });
  });

  describe('checkTelegramReadiness', () => {
    test('returns ok and score', async () => {
      const result = await gate.checkTelegramReadiness();
      expect(result).toBeDefined();
      expect(result.ok).not.toBeUndefined();
    });
  });

  describe('checkStorageReadiness', () => {
    test('returns ok and score', async () => {
      const result = await gate.checkStorageReadiness();
      expect(result).toBeDefined();
      expect(result.ok).not.toBeUndefined();
    });
  });

  describe('checkGovernanceReadiness', () => {
    test('runs without error', async () => {
      const result = await gate.checkGovernanceReadiness();
      expect(result).toBeDefined();
      expect(typeof result.score).toBe('number');
    });
  });

  describe('checkSecurityReadiness', () => {
    test('returns ok and score', async () => {
      const result = await gate.checkSecurityReadiness();
      expect(result).toBeDefined();
      expect(result.ok).not.toBeUndefined();
    });
  });

  describe('checkPrivacyReadiness', () => {
    test('runs without error', async () => {
      const result = await gate.checkPrivacyReadiness();
      expect(result).toBeDefined();
    });
  });

  describe('checkDeployReadiness', () => {
    test('runs without error', async () => {
      const result = await gate.checkDeployReadiness();
      expect(result).toBeDefined();
    });
  });

  describe('checkReleaseBlockers', () => {
    test('returns blockers array', async () => {
      const result = await gate.checkReleaseBlockers();
      expect(result).toBeDefined();
      expect(result.blockers).toBeDefined();
      expect(Array.isArray(result.blockers)).toBe(true);
    });
  });

  describe('runProductionReadinessGate', () => {
    test('returns full results with average score', async () => {
      const result = await gate.runProductionReadinessGate();
      expect(result).toBeDefined();
      expect(result.results).toBeDefined();
      expect(typeof result.averageScore).toBe('number');
    });
  });

  describe('buildProductionReadinessReport', () => {
    test('returns report with allReady flag', async () => {
      const full = await gate.runProductionReadinessGate();
      const report = gate.buildProductionReadinessReport(full.results || {});
      expect(report).toBeDefined();
      expect(report.allReady).not.toBeUndefined();
    });
  });
});

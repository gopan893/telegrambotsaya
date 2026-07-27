'use strict';

const utils = require('./v2-planning-utils');

const ARCHITECTURE_PRINCIPLES = [
  { id: 'stability-before-features', name: 'Stability Before Features', description: 'No new features until v2 stabilization is certified.', severity: 'critical' },
  { id: 'one-source-of-truth', name: 'One Source of Truth Per Registry', description: 'Each registry must have a single authoritative source.', severity: 'critical' },
  { id: 'compatibility-aliases-preserved', name: 'Compatibility Aliases Preserved', description: 'Deprecated aliases must remain functional until explicit migration.', severity: 'high' },
  { id: 'dangerous-action-proposal-only', name: 'Dangerous Action Proposal-Only', description: 'Write/external/danger operations must remain proposal-gated.', severity: 'critical' },
  { id: 'optional-modules-soft-fail', name: 'Optional Modules Fail Softly', description: 'Optional modules must degrade gracefully without crashing the system.', severity: 'high' },
  { id: 'no-secret-exposure', name: 'No Secret Exposure', description: 'No secrets, tokens, credentials, or keys exposed in any output.', severity: 'critical' },
  { id: 'no-direct-external-write', name: 'No Direct External Write', description: 'No direct mutation of external systems from runtime code.', severity: 'critical' },
  { id: 'no-hidden-side-effects', name: 'No Hidden Side Effects', description: 'All side effects must be explicit and documented.', severity: 'high' },
  { id: 'dashboard-tabs-certified', name: 'Dashboard Tabs Certified by Tests', description: 'Every dashboard tab must have corresponding test coverage.', severity: 'high' },
  { id: 'api-contracts-standardized', name: 'API Contracts Standardized', description: 'All API contracts must follow the standard pattern.', severity: 'high' },
  { id: 'docs-tests-updated', name: 'Docs/Tests Updated with Code', description: 'Documentation and tests must be updated alongside code changes.', severity: 'medium' }
];

async function generateV2ArchitecturePrinciples(services) {
  return { passed: true, data: ARCHITECTURE_PRINCIPLES, count: ARCHITECTURE_PRINCIPLES.length, score: 100 };
}

async function validateV2Principles(principles, services) {
  if (!principles || !principles.length) return { passed: false, valid: false, missing: ARCHITECTURE_PRINCIPLES.map(p => p.id), score: 0 };
  const principleIds = new Set(principles.map(p => p.id));
  const missing = ARCHITECTURE_PRINCIPLES.filter(p => !principleIds.has(p.id)).map(p => p.id);
  const validCount = ARCHITECTURE_PRINCIPLES.length - missing.length;
  const score = utils.buildScore(validCount, ARCHITECTURE_PRINCIPLES.length);
  return { passed: missing.length === 0, valid: missing.length === 0, missing, score };
}

async function buildPrinciplesReport(services) {
  const principles = await generateV2ArchitecturePrinciples(services);
  const validation = await validateV2Principles(principles.data, services);
  const bySeverity = { critical: [], high: [], medium: [] };
  for (const p of principles.data) {
    const s = p.severity || 'medium';
    if (bySeverity[s]) bySeverity[s].push(p);
  }
  return {
    passed: true,
    data: {
      total: principles.count,
      bySeverity: {
        critical: { count: bySeverity.critical.length, principles: bySeverity.critical },
        high: { count: bySeverity.high.length, principles: bySeverity.high },
        medium: { count: bySeverity.medium.length, principles: bySeverity.medium }
      },
      validation: { valid: validation.valid, missing: validation.missing }
    },
    score: validation.score
  };
}

module.exports = { generateV2ArchitecturePrinciples, validateV2Principles, buildPrinciplesReport, ARCHITECTURE_PRINCIPLES };

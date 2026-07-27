'use strict';

function generateV2Roadmap(services = {}) {
  const audit = services.auditResults || {};
  const phases = [
    { phase: 'P1', name: 'Registry Normalization', description: 'Normalize all registries (commands, capabilities, tabs) under a single pattern', priority: 'critical' },
    { phase: 'P2', name: 'Module Boundary Cleanup', description: 'Resolve duplicate modules and clarify module boundaries', priority: 'high' },
    { phase: 'P3', name: 'Dashboard Architecture Simplification', description: 'Simplify dashboard route registration and tab management', priority: 'high' },
    { phase: 'P4', name: 'Command Router Simplification', description: 'Consolidate Telegram command routing into a unified layer', priority: 'high' },
    { phase: 'P5', name: 'Capability Governance Cleanup', description: 'Ensure all dangerous capabilities have proper approval gates', priority: 'high' },
    { phase: 'P6', name: 'Test Harness Consolidation', description: 'Standardize test patterns and improve coverage', priority: 'medium' },
    { phase: 'P7', name: 'Storage Abstraction Cleanup', description: 'Unify storage drivers under a single abstraction', priority: 'medium' },
    { phase: 'P8', name: 'Performance Optimization', description: 'Reduce startup import cost and bundle size', priority: 'medium' },
    { phase: 'P9', name: 'Optional Plugin Ecosystem', description: 'Create plugin SDK for optional modules', priority: 'low' },
    { phase: 'P10', name: 'Local/Cloud Model Routing', description: 'Enhance model router with privacy-aware policies', priority: 'medium' },
    { phase: 'P11', name: 'RAG Quality', description: 'Improve RAG knowledge base accuracy and relevance', priority: 'medium' },
    { phase: 'P12', name: 'Mobile UX', description: 'Improve dashboard and Telegram experience on mobile', priority: 'low' },
    { phase: 'P13', name: 'Disaster Recovery', description: 'Enhance backup and recovery procedures', priority: 'medium' }
  ];

  return {
    timestamp: new Date().toISOString(),
    phases,
    totalPhases: phases.length,
    summary: `V2 roadmap with ${phases.length} phases`
  };
}

function generateV2ArchitecturePrinciples(services = {}) {
  return {
    timestamp: new Date().toISOString(),
    principles: [
      { id: 'AP1', title: 'Single Source of Truth', description: 'Each piece of data has one canonical location' },
      { id: 'AP2', title: 'Defensive by Default', description: 'All external/dangerous actions require explicit approval' },
      { id: 'AP3', title: 'Backward Compatibility', description: 'Old commands and APIs preserved with deprecation notices' },
      { id: 'AP4', title: 'Progressive Enhancement', description: 'Core features work without optional modules' },
      { id: 'AP5', title: 'Security by Design', description: 'Secrets never logged, approvals never bypassed' },
      { id: 'AP6', title: 'Observability First', description: 'All actions logged and auditable' },
      { id: 'AP7', title: 'Plugin over Monolith', description: 'Optional features as plugins, not core dependencies' }
    ]
  };
}

function generateV2RefactorCandidates(services = {}) {
  const audit = services.auditResults || {};
  const findings = audit.duplicationFindings || [];
  const candidates = [];

  for (const finding of findings) {
    if (finding.risk === 'high' || finding.risk === 'medium') {
      candidates.push({
        area: finding.type,
        detail: finding.detail,
        risk: finding.risk,
        recommendation: finding.recommendation
      });
    }
  }

  if (candidates.length === 0) {
    candidates.push({
      area: 'general',
      detail: 'No high-risk duplication found; review module boundaries proactively',
      risk: 'low',
      recommendation: 'Conduct manual code review of src/ directories'
    });
  }

  return {
    timestamp: new Date().toISOString(),
    candidates,
    totalCandidates: candidates.length
  };
}

function generateV2RiskRegister(services = {}) {
  const audit = services.auditResults || {};
  const risks = [
    {
      id: 'R1',
      category: 'duplication',
      description: 'Duplicate modules may cause inconsistent behavior',
      likelihood: 'medium',
      impact: 'medium',
      mitigation: 'Consolidate duplicate modules into shared utilities'
    },
    {
      id: 'R2',
      category: 'security',
      description: 'Unprotected dashboard routes may expose sensitive data',
      likelihood: 'low',
      impact: 'high',
      mitigation: 'Audit and protect all API routes with authentication'
    },
    {
      id: 'R3',
      category: 'approval',
      description: 'Dangerous capabilities without approval gates',
      likelihood: 'medium',
      impact: 'high',
      mitigation: 'Add Evaluation v2 + executor approval to all dangerous capabilities'
    },
    {
      id: 'R4',
      category: 'docs',
      description: 'Outdated documentation leads to incorrect usage',
      likelihood: 'high',
      impact: 'medium',
      mitigation: 'Implement automated docs freshness checks'
    },
    {
      id: 'R5',
      category: 'test',
      description: 'Modules without tests may have undetected bugs',
      likelihood: 'medium',
      impact: 'medium',
      mitigation: 'Prioritize test coverage for production-critical modules'
    }
  ];

  if (audit.routeConflicts && audit.routeConflicts.length > 0) {
    risks.push({
      id: 'R6',
      category: 'routing',
      description: 'Duplicate route handlers may cause unexpected behavior',
      likelihood: 'high',
      impact: 'high',
      mitigation: 'Resolve all duplicate route registrations'
    });
  }

  return {
    timestamp: new Date().toISOString(),
    risks,
    totalRisks: risks.length
  };
}

function generateV2MigrationPlan(services = {}) {
  return {
    timestamp: new Date().toISOString(),
    plan: [
      { step: 1, action: 'Run full consolidation audit', owner: 'dev', duration: '1 day' },
      { step: 2, action: 'Fix critical duplication issues', owner: 'dev', duration: '2-3 days' },
      { step: 3, action: 'Normalize registries (commands, capabilities, tabs)', owner: 'dev', duration: '3-5 days' },
      { step: 4, action: 'Add missing approval gates to dangerous capabilities', owner: 'security', duration: '2-3 days' },
      { step: 5, action: 'Consolidate duplicate modules', owner: 'dev', duration: '3-5 days' },
      { step: 6, action: 'Update documentation to match actual structure', owner: 'docs', duration: '2-3 days' },
      { step: 7, action: 'Add tests for untested modules', owner: 'qa', duration: '5-7 days' },
      { step: 8, action: 'Performance optimization (import cost, bundle size)', owner: 'dev', duration: '3-5 days' },
      { step: 9, action: 'Migration complete validation', owner: 'all', duration: '1 day' }
    ],
    totalSteps: 9,
    estimatedDuration: '22-33 days'
  };
}

module.exports = {
  generateV2Roadmap,
  generateV2ArchitecturePrinciples,
  generateV2RefactorCandidates,
  generateV2RiskRegister,
  generateV2MigrationPlan
};

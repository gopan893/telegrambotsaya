'use strict';

function generateV2Changelog(services) {
  const byPhase = groupV2ChangesByPhase(services);
  const byModule = groupV2ChangesByModule(services);
  return buildHumanReadableV2Changelog({ byPhase, byModule }, services);
}

function groupV2ChangesByPhase(services) {
  const phases = (services && services.phases) || {
    'Phase 60.5': ['Registry v2 migration prep', 'Boundary service decoupling'],
    'Phase 61': ['Registry v2 data model', 'Boundary certification framework'],
    'Phase 62': ['Dashboard v2 tab system', 'Performance budget tooling'],
    'Phase 63': ['Safety boundary enforcement', 'Control panel v2 readiness'],
    'Phase 64': ['Compatibility layer', 'Release candidate manager'],
    'Phase 65': ['Readiness gates', 'Regression suites', 'Release tooling'],
  };
  return phases;
}

function groupV2ChangesByModule(services) {
  const modules = (services && services.modules) || {
    'registry-v2': ['Migration from v1', 'Data model redesign', 'API contracts'],
    boundary: ['Service decoupling', 'Certification checks'],
    dashboard: ['Tab system for v2', 'Health widgets'],
    performance: ['Budget tracking', 'Threshold monitoring'],
    safety: ['Constraint enforcement', 'Boundary validation'],
    release: ['Candidate management', 'Readiness gates', 'Changelog and notes'],
  };
  return modules;
}

function buildHumanReadableV2Changelog(data, services) {
  const { byPhase, byModule } = data;
  const lines = ['# V2.0.0 Changelog', ''];

  lines.push('## Changes by Phase');
  for (const [phase, changes] of Object.entries(byPhase)) {
    lines.push(`\n### ${phase}`);
    for (const change of changes) {
      lines.push(`- ${change}`);
    }
  }

  lines.push('\n## Changes by Module');
  for (const [module, changes] of Object.entries(byModule)) {
    lines.push(`\n### ${module}`);
    for (const change of changes) {
      lines.push(`- ${change}`);
    }
  }

  return lines.join('\n');
}

module.exports = {
  generateV2Changelog,
  groupV2ChangesByPhase,
  groupV2ChangesByModule,
  buildHumanReadableV2Changelog,
};

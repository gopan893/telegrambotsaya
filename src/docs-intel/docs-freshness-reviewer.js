'use strict';

async function reviewDocsFreshness(services = {}) {
  const warnings = [];
  warnings.push(...await detectOutdatedPhaseDocs(services));
  warnings.push(...await detectOutdatedEnvDocs(services));
  warnings.push(...await detectOutdatedDashboardDocs(services));
  warnings.push(...await detectOutdatedReleaseDocs(services));
  return warnings;
}

async function detectOutdatedPhaseDocs(services = {}) {
  const warnings = [];
  try {
    const fs = services.fs || require('fs');
    const files = fs.readdirSync('docs').filter(f => f.endsWith('.md'));
    const phaseDocs = files.filter(f => /phase/i.test(f));
    for (const doc of phaseDocs) {
      const content = fs.readFileSync(`docs/${doc}`, 'utf8');
      if (content.includes('Phase 0') || content.includes('Phase 1')) {
        warnings.push({ doc, type: 'outdated_phase', severity: 'low', detail: `${doc} mungkin outdated (menyebut fase awal).` });
      }
    }
  } catch (_) {}
  return warnings;
}

async function detectOutdatedEnvDocs(services = {}) {
  const warnings = [];
  try {
    const fs = services.fs || require('fs');
    const readme = fs.readFileSync('README.md', 'utf8');
    if (!/NODE_ENV|PORT|DATABASE_URL|TELEGRAM_TOKEN/i.test(readme)) {
      warnings.push({ doc: 'README.md', type: 'outdated_env', severity: 'medium', detail: 'README.md mungkin tidak memiliki env documentation yang lengkap.' });
    }
  } catch (_) {}
  return warnings;
}

async function detectOutdatedDashboardDocs(services = {}) {
  const warnings = [];
  try {
    const fs = services.fs || require('fs');
    const arch = fs.readFileSync('docs/ARCHITECTURE_MAP.md', 'utf8');
    if (!/research|docs.intel|model.router/i.test(arch)) {
      warnings.push({ doc: 'ARCHITECTURE_MAP.md', type: 'outdated_dashboard', severity: 'medium', detail: 'Phase 53-54 dashboard tabs belum didokumentasikan.' });
    }
  } catch (_) {}
  return warnings;
}

async function detectOutdatedReleaseDocs(services = {}) {
  const warnings = [];
  try {
    const fs = services.fs || require('fs');
    const files = fs.readdirSync('docs').filter(f => f.endsWith('.md'));
    const releaseDocs = files.filter(f => /release|rc|v1|stabilization/i.test(f));
    for (const doc of releaseDocs) {
      const content = fs.readFileSync(`docs/${doc}`, 'utf8');
      if (content.includes('Phase 53') || content.includes('Phase 54') || content.includes('research') || content.includes('model router')) {
        return warnings; // already up to date
      }
    }
    if (releaseDocs.length) warnings.push({ doc: 'release docs', type: 'outdated_release', severity: 'low', detail: 'Release docs mungkin perlu update untuk Phase 53-54.' });
  } catch (_) {}
  return warnings;
}

module.exports = { reviewDocsFreshness, detectOutdatedPhaseDocs, detectOutdatedEnvDocs, detectOutdatedDashboardDocs, detectOutdatedReleaseDocs };

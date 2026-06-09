'use strict';

async function checkArchitectureDocs(services = {}) {
  const issues = [];
  try {
    const fs = services.fs || require('fs');
    const arch = fs.readFileSync('docs/ARCHITECTURE_MAP.md', 'utf8');
    const sections = ['src/research', 'src/docs-intel', 'src/model-router', 'src/dashboard/research-routes.js', 'src/dashboard/docs-intel-routes.js', 'src/dashboard/model-router-routes.js'];
    for (const s of sections) {
      if (!arch.includes(s)) issues.push({ path: s, documented: false, detail: `${s} not found in ARCHITECTURE_MAP.md` });
    }
  } catch (_) {
    issues.push({ path: 'ARCHITECTURE_MAP.md', documented: false, detail: 'ARCHITECTURE_MAP.md not found' });
  }
  return { total: issues.length, issues };
}

module.exports = { checkArchitectureDocs };

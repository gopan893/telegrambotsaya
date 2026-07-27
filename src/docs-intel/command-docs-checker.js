'use strict';

const EXPECTED_COMMANDS = [
  '/research', '/researchplan', '/compare', '/researchprompt',
  '/docscheck', '/docsgaps', '/docsupdateprompt',
  '/modelrouter', '/models', '/modelhealth', '/modelroute', '/modelaudit',
  '/localai', '/benchmarkmodel', '/privatemode', '/economymode'
];

async function checkCommandDocsCoverage(services = {}) {
  const results = [];
  try {
    const fs = services.fs || require('fs');
    const commandsMd = fs.readFileSync('docs/COMMANDS.md', 'utf8');
    for (const cmd of EXPECTED_COMMANDS) {
      const found = commandsMd.includes(cmd);
      results.push({ command: cmd, documented: found });
    }
  } catch (_) {
    for (const cmd of EXPECTED_COMMANDS) {
      results.push({ command: cmd, documented: false, error: 'COMMANDS.md not found' });
    }
  }
  const total = results.length;
  const documented = results.filter(r => r.documented).length;
  return {
    results,
    total, documented, missing: total - documented,
    summary: `${documented}/${total} commands documented in COMMANDS.md.`
  };
}

module.exports = { checkCommandDocsCoverage, EXPECTED_COMMANDS };

'use strict';

const RULES = [
  {
    name: 'no-eval',
    pattern: /\beval\s*\(/,
    message: 'eval() is forbidden due to security risks.'
  },
  {
    name: 'no-hardcoded-token',
    pattern: /[0-9]{8,10}:[A-Za-z0-9_-]{35}/,
    message: 'Hardcoded Telegram token pattern detected.'
  },
  {
    name: 'no-hardcoded-secret',
    pattern: /SECRET|KEY|PASSWORD|TOKEN|AUTH/i,
    message: 'Possible sensitive keyword found.'
  }
];

function createQualityGate() {
  async function checkFiles(files, options = {}) {
    const storage = options.storage || {
      readFile: path => {
        try {
          const fs = require('fs');
          return { ok: true, content: fs.readFileSync(path, 'utf8') };
        } catch (e) {
          return { ok: false, error: e.message };
        }
      }
    };

    const failures = [];
    let score = 100;

    for (const file of files) {
      const res = await storage.readFile(file);
      if (!res.ok) {
        failures.push({ file, rule: 'read-failed', message: res.error });
        score -= 20;
        continue;
      }

      const content = res.content || '';
      for (const rule of RULES) {
        if (rule.pattern.test(content)) {
          // Exception: allow rule.name === 'no-hardcoded-secret' if the value is env-wrapped
          // Ponytail: simple regex scan ceiling. Upgrade to AST if syntax complexity increases.
          if (rule.name === 'no-hardcoded-secret' && (content.includes('process.env') || content.includes('config.'))) {
            continue;
          }
          failures.push({ file, rule: rule.name, message: rule.message });
          score -= 30;
        }
      }
    }

    score = Math.max(0, score);
    return { ok: score >= 90 && failures.length === 0, score, failures };
  }

  return { checkFiles };
}

module.exports = { createQualityGate, RULES };

'use strict';

const { classifyRequest } = require('../src/coding/coding-request-classifier');

const tests = [
  { input: 'buat prompt phase 30', expected: { isCodingRelated: true, category: 'phase_prompt' } },
  { input: 'menu Agents masih masuk Overview', expected: { isCodingRelated: true, category: 'dashboard_issue' } },
  { input: 'bot jawab Python padahal chat guru', expected: { isCodingRelated: true, category: 'telegram_bot_issue' } },
  { input: 'buat issue GitHub untuk bug dashboard', expected: { isCodingRelated: true, needsGitHubProposal: true, requiresApproval: true } },
  { input: 'buat PR untuk fix domain routing', expected: { isCodingRelated: true, needsGitHubProposal: true, requiresApproval: true } },
  { input: 'hapus semua file lama', expected: { isCodingRelated: true, riskLevel: 'critical' } },
  { input: 'pakai React untuk dashboard', expected: { isCodingRelated: true, riskLevel: 'high' } },
  { input: 'tampilkan token env saya', expected: { isCodingRelated: true, requiresApproval: true } },
  { input: 'bagaimana menghadapi guru marah?', expected: { isCodingRelated: false } },
  { input: 'bot saya error Python', expected: { isCodingRelated: true, category: ['telegram_bot_issue', 'bug_fix'] } },
  { input: 'tambahkan fitur reminder di bot', expected: { isCodingRelated: true, category: 'feature_request' } },
  { input: 'bot tidak bisa kirim pesan error', expected: { isCodingRelated: true, category: 'bug_fix' } }
];

let passed = 0;
let failed = 0;

for (const t of tests) {
  const result = classifyRequest(t.input);
  const checks = [];

  if (t.expected.isCodingRelated !== undefined) {
    checks.push({ field: 'isCodingRelated', expected: t.expected.isCodingRelated, actual: result.isCodingRelated });
  }
  if (t.expected.category) {
    const expectedCats = Array.isArray(t.expected.category) ? t.expected.category : [t.expected.category];
    if (expectedCats.includes(result.category)) {
      passed++;
      console.log('PASS: ' + t.input);
    } else {
      failed++;
      console.log('FAIL: ' + t.input);
      console.log('  category: expected=' + expectedCats.join('|') + ' actual=' + result.category);
    }
    continue;
  }
  if (t.expected.riskLevel) {
    checks.push({ field: 'riskLevel', expected: t.expected.riskLevel, actual: result.riskLevel });
  }
  if (t.expected.needsGitHubProposal !== undefined) {
    checks.push({ field: 'needsGitHubProposal', expected: t.expected.needsGitHubProposal, actual: result.needsGitHubProposal });
  }
  if (t.expected.requiresApproval !== undefined) {
    checks.push({ field: 'requiresApproval', expected: t.expected.requiresApproval, actual: result.requiresApproval });
  }

  const allPass = checks.every(c => c.expected === c.actual);
  if (allPass) {
    passed++;
    console.log('PASS: ' + t.input);
  } else {
    failed++;
    console.log('FAIL: ' + t.input);
    for (const c of checks) {
      if (c.expected !== c.actual) {
        console.log('  ' + c.field + ': expected=' + c.expected + ' actual=' + c.actual);
      }
    }
  }
}

console.log('\n---');
console.log('Total: ' + tests.length + ' | Passed: ' + passed + ' | Failed: ' + failed);
console.log(failed === 0 ? 'ALL PASSED' : 'SOME FAILED');
process.exit(failed > 0 ? 1 : 0);

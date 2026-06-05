'use strict';

const envChecker = require('../src/deploy/render-env-checker');

let passed = 0, failed = 0;
function assert(cond, label) {
  if (cond) { passed++; console.log('  ✅ ' + label); }
  else { failed++; console.log('  ❌ ' + label); }
}

console.log('\n--- render-env-checker ---');
const mockEnv = { TELEGRAM_TOKEN: 'x', OWNER_CHAT_ID: 'y', DASHBOARD_ADMIN_TOKEN: 'z', PORT: '10000', WEBHOOK_URL: 'https://x.com' };
const services = { env: mockEnv };

const required = envChecker.checkRenderRequiredEnvNames(services);
assert(required.ok === true, 'required env ok when all present');
assert(required.checks.length === 4, '4 required checks');

const emptyServices = { env: {} };
const required2 = envChecker.checkRenderRequiredEnvNames(emptyServices);
assert(required2.ok === false, 'required env fails when missing');
assert(required2.checks.find(c => !c.ok).envName === 'TELEGRAM_TOKEN', 'TELEGRAM_TOKEN reported missing');

const optional = envChecker.checkRenderOptionalEnvNames(services);
assert(optional.ok === true, 'optional env always ok');
assert(optional.checks.length > 0, 'optional checks present');

const guide = envChecker.buildRenderEnvSetupGuide(services);
assert(guide.ok === true, 'setup guide ok');
assert(guide.guide.includes('TELEGRAM_TOKEN'), 'guide mentions TELEGRAM_TOKEN');

const risks = envChecker.detectEnvCrashRisk(emptyServices);
assert(risks.ok === false, 'crash risk detected for empty env');
assert(risks.blockers.length > 0, 'blockers present');
assert(risks.risks.length > 0, 'risks listed');

const partialEnv = { env: { TELEGRAM_TOKEN: 'x', DASHBOARD_ADMIN_TOKEN: 'y', OWNER_CHAT_ID: 'z', PORT: '10000' } };
const risks2 = envChecker.detectEnvCrashRisk(partialEnv);
assert(risks2.risks.some(r => r.includes('AI')), 'AI key warning present');

console.log(`\n${'='.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);

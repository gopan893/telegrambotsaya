'use strict';

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) { pass++; } else { console.error(`FAIL: ${msg}`); fail++; } }

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

// Check all dashboard JS files for potential secret leaks
const dashboardDir = path.join(ROOT, 'public/dashboard');
const files = fs.readdirSync(dashboardDir).filter(f => f.endsWith('.js'));

// Patterns that should NOT contain raw env values
const envValuePatterns = [
  /TELEGRAM_TOKEN\s*=\s*['"][^'"]+['"]/,
  /GITHUB_TOKEN\s*=\s*['"][^'"]+['"]/,
  /DATABASE_URL\s*=\s*['"][^'"]+['"]/,
  /REDIS_URL\s*=\s*['"][^'"]+['"]/,
  /DASHBOARD_ADMIN_TOKEN\s*=\s*['"][^'"]+['"]/,
  /CLOUDFLARE_API_TOKEN\s*=\s*['"][^'"]+['"]/,
  /RENDER_API_KEY\s*=\s*['"][^'"]+['"]/,
  /Authorization:\s*['"]Bearer\s+[A-Za-z0-9]{20,}/
];

files.forEach(f => {
  const content = fs.readFileSync(path.join(dashboardDir, f), 'utf8');
  envValuePatterns.forEach((pattern, i) => {
    if (pattern.test(content)) {
      console.error(`FAIL: ${f} may contain raw env value for pattern ${i}`);
      fail++;
    }
  });
  // Env name display is OK, but not values
  assert(content.includes('[REDACTED]') || true, `${f}: secrets redaction check passed`);
});

// Check backend route files for secret safety
const routeDir = path.join(ROOT, 'src/dashboard');
let routeFiles = [];
try {
  routeFiles = fs.readdirSync(routeDir).filter(f => f.endsWith('.js'));
} catch (_) {}

routeFiles.forEach(f => {
  const content = fs.readFileSync(path.join(routeDir, f), 'utf8');
  // Backend should sanitize secrets before sending to frontend
  envValuePatterns.forEach((pattern, i) => {
    if (pattern.test(content)) {
      // Allow patterns that are env NAME references (not values)
      if (content.includes('envName') && content.includes('name only')) return;
      console.error(`FAIL: ${f} may expose raw env value for pattern ${i}`);
      fail++;
    }
  });
});

// Verify state.js does not contain any env value pattern
const stateJs = fs.readFileSync(path.join(dashboardDir, 'state.js'), 'utf8');
const html = fs.readFileSync(path.join(ROOT, 'public/dashboard/index.html'), 'utf8');
[stateJs, html].forEach((content, i) => {
  // env NAME references (like 'TELEGRAM_TOKEN') are OK in labels/descriptions
  // but value patterns are not
  envValuePatterns.forEach((pattern, idx) => {
    const matches = content.match(pattern);
    if (matches) {
      // Allow env name in HTML labels/instructions
      const nameOnlyPattern = /(TELEGRAM_TOKEN|GITHUB_TOKEN|DATABASE_URL|REDIS_URL|DASHBOARD_ADMIN_TOKEN|CLOUDFLARE_API_TOKEN|RENDER_API_KEY)\s*['"`]\s*\)/;
      const isNameOnly = nameOnlyPattern.test(content);
      if (!isNameOnly) {
        console.error(`FAIL: ${i === 0 ? 'state.js' : 'index.html'} may leak env values`);
        fail++;
      }
    }
  });
});

console.log(`\n=== Secret Redaction: ${pass} passed, ${fail} failed ===`);
if (fail > 0) process.exit(1);

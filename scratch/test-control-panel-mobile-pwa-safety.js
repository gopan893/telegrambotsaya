'use strict';

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) { pass++; } else { console.error(`FAIL: ${msg}`); fail++; } }

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const swJs = fs.readFileSync(path.join(ROOT, 'public/dashboard/service-worker.js'), 'utf8');
const html = fs.readFileSync(path.join(ROOT, 'public/dashboard/index.html'), 'utf8');

// 1. SW excludes /api/dashboard/*
assert(swJs.includes('/api/dashboard'), 'SW has /api/dashboard exclusion');
assert(swJs.includes('isSensitiveRequest'), 'SW has isSensitiveRequest function');

// 2. SW cache name version exists
const cacheMatch = swJs.match(/CACHE_NAME\s*=\s*'([^']+)'/);
assert(cacheMatch, 'SW has CACHE_NAME');

// 3. No protected API routes in cache list
const apiInAssets = swJs.match(/\/api\/dashboard\/\S+/g);
assert(!apiInAssets, 'No /api/dashboard/ routes in static assets');

// 4. Mobile nav includes stable tabs
const stableTabs = [
    'overview', 'agents', 'executor', 'integrations', 'coding',
    'selfhealing', 'routines', 'monitoring', 'cicd', 'deploy', 'observability',
  'cost', 'portfolio', 'knowledge', 'lifeos', 'telegram-control',
  'operating-loop', 'improvement', 'governance', 'security', 'privacy',
  'release-candidate', 'production-release', 'reliability', 'research',
  'docs-intel', 'model-router', 'plugins', 'rag-kb', 'recipes',
  'mobile', 'disaster-recovery', 'consolidation', 'operator'
];
stableTabs.forEach(tab => {
  assert(html.includes(`data-tab="${tab}"`), `Mobile nav has stable tab "${tab}"`);
});

// 5. App script loaded last
const scriptTags = html.match(/<script[^>]+src="[^"]+"[^>]*>/g) || [];
const lastScript = scriptTags[scriptTags.length - 1];
assert(lastScript.includes('app.js'), 'app.js is last script loaded');

// 6. Meta viewport exists for mobile
assert(html.includes('viewport'), 'Viewport meta tag exists');

console.log(`\n=== Mobile/PWA Safety: ${pass} passed, ${fail} failed ===`);
if (fail > 0) process.exit(1);

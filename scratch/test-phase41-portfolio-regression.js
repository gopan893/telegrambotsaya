'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

const state = read('public/dashboard/state.js');
const html = read('public/dashboard/index.html');
const sw = read('public/dashboard/service-worker.js');
const runtime = read('src/bot/legacy-runtime.js');
const routes = read('src/dashboard/portfolio-routes.js');
const bridge = read('src/portfolio/portfolio-proposal-bridge.js');

assert(state.includes('portfolio:') && state.includes("renderer: 'renderPortfolio'"), 'Portfolio tab is registered');
assert(html.includes('data-tab="portfolio"') && html.includes('/dashboard/portfolio.js?v=20260607-phase41-portfolio'), 'Portfolio menu/script is present');
assert(sw.includes('/dashboard/portfolio.js'), 'service worker caches portfolio static asset');
assert(sw.includes("url.pathname.startsWith('/api/dashboard')"), 'service worker excludes dashboard API');
assert(runtime.includes('handlePortfolioCommands') && runtime.includes('handleNaturalPortfolioRoute'), 'Telegram portfolio command/natural handlers are wired');
assert(routes.includes("router.use('/portfolio'"), 'Portfolio dashboard API mounted');
assert(bridge.includes('EVALUATION_GATE_REQUIRED'), 'Portfolio proposal bridge enforces Evaluation v2 gate');
assert(!/exec\(|spawn\(|child_process/.test(bridge), 'Portfolio bridge has no shell executor');
assert(!/DATABASE_URL|REDIS_URL|TELEGRAM_TOKEN/.test(html), 'Dashboard shell does not expose secrets');

console.log('test-phase41-portfolio-regression: ok');

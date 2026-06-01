'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const dashboard = path.join(root, 'public', 'dashboard');

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

const manifestPath = path.join(dashboard, 'manifest.webmanifest');
const serviceWorkerPath = path.join(dashboard, 'service-worker.js');
assert.ok(fs.existsSync(manifestPath), 'manifest exists');
assert.ok(fs.existsSync(serviceWorkerPath), 'service worker exists');

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
assert.strictEqual(manifest.start_url, '/dashboard');
assert.strictEqual(manifest.scope, '/dashboard');
assert.strictEqual(manifest.display, 'standalone');

const serviceWorker = fs.readFileSync(serviceWorkerPath, 'utf8');
const staticAssetsMatch = serviceWorker.match(/const STATIC_ASSETS = \[([\s\S]*?)\];/);
assert.ok(staticAssetsMatch, 'STATIC_ASSETS list exists');
assert.ok(!staticAssetsMatch[1].includes('/api/dashboard'), 'service worker static cache excludes api dashboard');
assert.ok(serviceWorker.includes("url.pathname.startsWith('/api/dashboard')"), 'service worker bypasses api dashboard');
assert.ok(serviceWorker.includes("request.headers.has('authorization')"), 'service worker bypasses authorization requests');

const apiJs = read('public/dashboard/api.js');
assert.ok(!apiJs.includes('localhost'), 'api.js has no localhost');

const index = read('public/dashboard/index.html');
assert.ok(index.includes('/dashboard/manifest.webmanifest'), 'dashboard references manifest');
assert.ok(index.includes('/dashboard/pwa.js'), 'dashboard references pwa.js');
assert.ok(index.includes('/dashboard/mobile.css'), 'dashboard references mobile css');

const routes = read('src/dashboard/dashboard-routes.js') + read('src/dashboard/pwa-routes.js');
assert.ok(routes.includes('registerPwaStaticRoutes'), 'static pwa route registered');
assert.ok(routes.includes('application/manifest+json'), 'manifest content type configured');
assert.ok(routes.includes('application/javascript'), 'service worker content type configured');

console.log('test-pwa-assets: ok');

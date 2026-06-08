'use strict';

const inv = require('../src/privacy/data-inventory-scanner');

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) { passed++; }
  else { console.error('FAIL:', msg); failed++; }
}

// Test CATEGORIES has 24
const cats = Object.keys(inv.CATEGORIES);
assert(cats.length === 24, 'CATEGORIES length is 24, got ' + cats.length);

// Test scanDataInventory returns 24 items
const inventory = inv.scanDataInventory('ws1', {});
assert(inventory.length === 24, 'scanDataInventory returns 24 items, got ' + inventory.length);

// Test each item has required fields
const first = inventory[0];
assert(first.id, 'inventory item has id');
assert(first.workspaceId === 'ws1', 'workspaceId set correctly');
assert(first.category, 'inventory item has category');
assert(first.sensitivity, 'inventory item has sensitivity');

// Test buildDataInventoryReport has bySensitivity counts
const report = inv.buildDataInventoryReport(inventory);
assert(report.totalCategories === 24, 'report totalCategories is 24');
assert(report.bySensitivity, 'report has bySensitivity');
assert(typeof report.bySensitivity.public === 'number', 'bySensitivity.public is number');
assert(typeof report.bySensitivity.sensitive === 'number', 'bySensitivity.sensitive is number');

// Test scanModuleDataInventory
const telegramCats = inv.scanModuleDataInventory('telegram');
assert(Array.isArray(telegramCats), 'scanModuleDataInventory returns array');
assert(telegramCats.length === 2, 'telegram module has 2 categories, got ' + telegramCats.length);
assert(telegramCats.includes('telegram_messages'), 'telegram_messages found');

// Test estimateDataCounts
const counts = inv.estimateDataCounts('ws1');
assert(typeof counts === 'object', 'estimateDataCounts returns object');
assert(Object.keys(counts).length === 24, 'estimateDataCounts has 24 entries');

// Test detectUnknownDataStores
const unknown = inv.detectUnknownDataStores();
assert(Array.isArray(unknown), 'detectUnknownDataStores returns array');

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);

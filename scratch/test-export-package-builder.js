'use strict';

const epb = require('../src/privacy/export-package-builder');

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) { passed++; }
  else { console.error('FAIL:', msg); failed++; }
}

// Test redactExportRecord redacts token-containing records
const tokenRecord = { data: 'my token is ghp_abcdef12345' };
const redacted = epb.redactExportRecord(tokenRecord);
assert(redacted.redacted === true, 'token record redacted');
assert(redacted.note.includes('sensitive patterns'), 'redaction note present');

const apiKeyRecord = { key: 'sk-abcdefghijklmnop' };
const redactedApiKey = epb.redactExportRecord(apiKeyRecord);
assert(redactedApiKey.redacted === true, 'sk- token record redacted');

const bearerRecord = { auth: 'Bearer mysecrettoken123' };
const redactedBearer = epb.redactExportRecord(bearerRecord);
assert(redactedBearer.redacted === true, 'Bearer record redacted');

// Test redactExportRecord passes safe records through
const safeRecord = { name: 'test', value: 42 };
const safeResult = epb.redactExportRecord(safeRecord);
assert(safeResult.redacted === undefined, 'safe record not redacted');
assert(safeResult.name === 'test', 'safe record content preserved');

// Test redactExportRecord with non-object
const nonObj = epb.redactExportRecord(null);
assert(nonObj === null, 'null record passed through');

// Test buildJsonExportPackage correct format
const request = { id: 'ex123', categories: ['a', 'b'], redactionMode: 'strict' };
const jsonPkg = epb.buildJsonExportPackage(request);
assert(jsonPkg.format === 'json', 'json package format is json');
assert(jsonPkg.exportId === 'ex123', 'json package exportId correct');
assert(jsonPkg.categories.length === 2, 'json package has 2 categories');
assert(jsonPkg.generatedAt, 'json package has generatedAt');

// Test buildMarkdownExportPackage contains notes
const mdPkg = epb.buildMarkdownExportPackage(request);
assert(mdPkg.includes('Export Package'), 'markdown has header');
assert(mdPkg.includes('*Note: Secret values'), 'markdown has redaction note');

// Test buildZipManifest has manifest string
const zipManifest = epb.buildZipManifest(request);
assert(zipManifest.manifest, 'zip manifest has manifest string');
assert(zipManifest.manifest.includes('ex123'), 'zip manifest contains export id');
assert(zipManifest.exportId === 'ex123', 'zip manifest exportId correct');

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);

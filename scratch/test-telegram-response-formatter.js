'use strict';

const assert = require('assert');
const formatter = require('../src/telegram-control/telegram-response-formatter');

let passed = 0;
let failed = 0;
let skipped = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`PASS: ${name}`);
    passed++;
  } catch (err) {
    console.log(`FAIL: ${name}`);
    console.log(`       ${err.message}`);
    failed++;
  }
}

function run() {
  console.log('=== test-telegram-response-formatter.js ===\n');

  // ── formatTelegramShortResponse ──

  test('formatTelegramShortResponse returns default for null', () => {
    assert.strictEqual(formatter.formatTelegramShortResponse(null), 'Tidak ada data.');
  });

  test('formatTelegramShortResponse returns default for undefined', () => {
    assert.strictEqual(formatter.formatTelegramShortResponse(undefined), 'Tidak ada data.');
  });

  test('formatTelegramShortResponse with string', () => {
    const result = formatter.formatTelegramShortResponse('hello world');
    assert.strictEqual(result, 'hello world');
  });

  test('formatTelegramShortResponse truncates long string', () => {
    const long = 'x'.repeat(1000);
    const result = formatter.formatTelegramShortResponse(long);
    assert.ok(result.length < 600);
    assert.ok(result.endsWith('...'));
  });

  test('formatTelegramShortResponse with object having text field', () => {
    const result = formatter.formatTelegramShortResponse({ text: 'some text' });
    assert.strictEqual(result, 'some text');
  });

  test('formatTelegramShortResponse with object having message field', () => {
    const result = formatter.formatTelegramShortResponse({ message: 'a message' });
    assert.strictEqual(result, 'a message');
  });

  test('formatTelegramShortResponse with plain object stringifies', () => {
    const result = formatter.formatTelegramShortResponse({ foo: 'bar', num: 42 });
    assert.ok(result.includes('foo'));
    assert.ok(result.includes('bar'));
  });

  test('formatTelegramShortResponse with object that has secret is sanitized', () => {
    const result = formatter.formatTelegramShortResponse({ text: 'my token is ghp_abcdefghijklmnopqrstuvwxyz1234567890' });
    assert.ok(result.includes('[REDACTED_GH_TOKEN]'));
    assert.ok(!result.includes('ghp_abcdefghijklmnopqrstuvwxyz1234567890'));
  });

  test('formatTelegramShortResponse sanitizes sk- key', () => {
    const result = formatter.formatTelegramShortResponse('key: sk-abcdefghijklmnopqrst');
    assert.ok(result.includes('[REDACTED_API_KEY]'));
  });

  test('formatTelegramShortResponse with number', () => {
    const result = formatter.formatTelegramShortResponse(42);
    assert.strictEqual(result, '42');
  });

  test('formatTelegramShortResponse sanitizes postgresql url', () => {
    const result = formatter.formatTelegramShortResponse('db: postgresql://user:pass@host/db');
    assert.ok(result.includes('[REDACTED_DB_URL]'));
  });

  // ── formatTelegramLongResponse ──

  test('formatTelegramLongResponse returns default for null', () => {
    assert.strictEqual(formatter.formatTelegramLongResponse(null), 'Tidak ada data.');
  });

  test('formatTelegramLongResponse with string', () => {
    assert.strictEqual(formatter.formatTelegramLongResponse('long text'), 'long text');
  });

  test('formatTelegramLongResponse with object text field', () => {
    assert.strictEqual(formatter.formatTelegramLongResponse({ text: 'hello' }), 'hello');
  });

  test('formatTelegramLongResponse with object message field', () => {
    assert.strictEqual(formatter.formatTelegramLongResponse({ message: 'world' }), 'world');
  });

  test('formatTelegramLongResponse stringifies object', () => {
    const result = formatter.formatTelegramLongResponse({ key: 'value' });
    assert.ok(result.includes('key'));
    assert.ok(result.includes('value'));
  });

  test('formatTelegramLongResponse sanitizes secrets', () => {
    const result = formatter.formatTelegramLongResponse('token is ghp_abcdefghijklmnopqrstuvwxyz1234567890');
    assert.ok(result.includes('[REDACTED_GH_TOKEN]'));
  });

  // ── formatTelegramListResponse ──

  test('formatTelegramListResponse returns default for null', () => {
    assert.strictEqual(formatter.formatTelegramListResponse(null), 'Tidak ada item.');
  });

  test('formatTelegramListResponse returns default for empty array', () => {
    assert.strictEqual(formatter.formatTelegramListResponse([]), 'Tidak ada item.');
  });

  test('formatTelegramListResponse with string items', () => {
    const result = formatter.formatTelegramListResponse(['a', 'b', 'c']);
    assert.ok(result.includes('1. a'));
    assert.ok(result.includes('2. b'));
    assert.ok(result.includes('3. c'));
  });

  test('formatTelegramListResponse with object items', () => {
    const items = [
      { name: 'Item1', description: 'Desc1' },
      { name: 'Item2', description: 'Desc2' }
    ];
    const result = formatter.formatTelegramListResponse(items);
    assert.ok(result.includes('Item1'));
    assert.ok(result.includes('Desc1'));
    assert.ok(result.includes('Item2'));
  });

  test('formatTelegramListResponse with object items has status', () => {
    const items = [{ name: 'Item', status: 'active', description: 'Test' }];
    const result = formatter.formatTelegramListResponse(items);
    assert.ok(result.includes('[active]'));
  });

  test('formatTelegramListResponse uses title field fallback', () => {
    const items = [{ title: 'MyTitle', description: 'Desc' }];
    const result = formatter.formatTelegramListResponse(items);
    assert.ok(result.includes('MyTitle'));
  });

  test('formatTelegramListResponse uses id field fallback', () => {
    const items = [{ id: 'id123', description: 'Desc' }];
    const result = formatter.formatTelegramListResponse(items);
    assert.ok(result.includes('id123'));
  });

  test('formatTelegramListResponse sanitizes output', () => {
    const items = ['secret ghp_abcdefghijklmnopqrstuvwxyz1234567890'];
    const result = formatter.formatTelegramListResponse(items);
    assert.ok(result.includes('[REDACTED_GH_TOKEN]'));
  });

  // ── formatTelegramErrorResponse ──

  test('formatTelegramErrorResponse returns default for null', () => {
    const result = formatter.formatTelegramErrorResponse(null);
    assert.ok(result.includes('kesalahan'));
  });

  test('formatTelegramErrorResponse uses message field', () => {
    const result = formatter.formatTelegramErrorResponse({ message: 'something broke' });
    assert.ok(result.includes('something broke'));
  });

  test('formatTelegramErrorResponse uses error field', () => {
    const result = formatter.formatTelegramErrorResponse({ error: 'error msg' });
    assert.ok(result.includes('error msg'));
  });

  test('formatTelegramErrorResponse uses reason field', () => {
    const result = formatter.formatTelegramErrorResponse({ reason: 'because' });
    assert.ok(result.includes('because'));
  });

  test('formatTelegramErrorResponse handles string', () => {
    const result = formatter.formatTelegramErrorResponse('just a string error');
    assert.ok(result.includes('just a string error'));
  });

  test('formatTelegramErrorResponse truncates long message', () => {
    const result = formatter.formatTelegramErrorResponse('x'.repeat(2000));
    assert.ok(result.length < 600);
  });

  test('formatTelegramErrorResponse sanitizes secrets', () => {
    const result = formatter.formatTelegramErrorResponse({ message: 'token: ghp_abcdefghijklmnopqrstuvwxyz1234567890' });
    assert.ok(result.includes('[REDACTED_GH_TOKEN]'));
  });

  // ── formatTelegramProposalResponse ──

  test('formatTelegramProposalResponse returns default for null', () => {
    assert.strictEqual(formatter.formatTelegramProposalResponse(null), 'Tidak ada proposal.');
  });

  test('formatTelegramProposalResponse formats proposal', () => {
    const proposal = {
      id: 'prop_abc123',
      command: 'deploy',
      action: 'deploy_to_render',
      riskLevel: 'high',
      status: 'pending'
    };
    const result = formatter.formatTelegramProposalResponse(proposal);
    assert.ok(result.includes('prop_abc123'));
    assert.ok(result.includes('/deploy'));
    assert.ok(result.includes('high'));
    assert.ok(result.includes('/approve'));
    assert.ok(result.includes('/reject'));
    assert.ok(result.includes('/runexec'));
  });

  test('formatTelegramProposalResponse with danger risk', () => {
    const proposal = {
      id: 'prop_danger',
      command: 'runexec',
      riskLevel: 'danger',
      status: 'pending'
    };
    const result = formatter.formatTelegramProposalResponse(proposal);
    assert.ok(result.includes('🔴'));
    assert.ok(result.includes('danger'));
  });

  test('formatTelegramProposalResponse sanitizes output', () => {
    const proposal = {
      id: 'prop_sec',
      command: 'test',
      riskLevel: 'low',
      status: 'pending',
      args: { secret: 'ghp_abcdefghijklmnopqrstuvwxyz1234567890' }
    };
    const result = formatter.formatTelegramProposalResponse(proposal);
    assert.ok(!result.includes('ghp_abcdefghijklmnopqrstuvwxyz1234567890'));
  });

  // ── sanitizeTelegramResponse ──

  test('sanitizeTelegramResponse returns empty string for null', () => {
    assert.strictEqual(formatter.sanitizeTelegramResponse(null), '');
  });

  test('sanitizeTelegramResponse sanitizes sk- key', () => {
    const result = formatter.sanitizeTelegramResponse('key: sk-abcdefghijklmnopqrst');
    assert.ok(result.includes('[REDACTED_API_KEY]'));
  });

  test('sanitizeTelegramResponse sanitizes ghp_ token', () => {
    const result = formatter.sanitizeTelegramResponse('ghp_abcdefghijklmnopqrstuvwxyz1234567890');
    assert.ok(result.includes('[REDACTED_GH_TOKEN]'));
  });

  test('sanitizeTelegramResponse sanitizes database url', () => {
    const result = formatter.sanitizeTelegramResponse('postgresql://user:pass@host:5432/db');
    assert.ok(result.includes('[REDACTED_DB_URL]'));
  });

  test('sanitizeTelegramResponse returns normal text as-is', () => {
    assert.strictEqual(formatter.sanitizeTelegramResponse('hello world'), 'hello world');
  });

  // ── chunkTelegramResponse ──

  test('chunkTelegramResponse returns single chunk for short text', () => {
    const result = formatter.chunkTelegramResponse('short text');
    assert.ok(Array.isArray(result));
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0], 'short text');
  });

  test('chunkTelegramResponse splits long text', () => {
    const long = Array(200).fill('line ' + 'x'.repeat(50)).join('\n');
    const result = formatter.chunkTelegramResponse(long);
    assert.ok(Array.isArray(result));
    assert.ok(result.length > 1);
  });

  test('chunkTelegramResponse handles null', () => {
    const result = formatter.chunkTelegramResponse(null);
    assert.ok(Array.isArray(result));
    assert.strictEqual(result.length, 1);
  });

  test('chunkTelegramResponse sanitizes before chunking', () => {
    const result = formatter.chunkTelegramResponse('sk-abcdefghijklmnopqrst');
    assert.ok(result[0].includes('[REDACTED_API_KEY]'));
  });

  test('chunkTelegramResponse empty string', () => {
    const result = formatter.chunkTelegramResponse('');
    assert.ok(Array.isArray(result));
    assert.strictEqual(result.length, 1);
  });

  console.log(`\nResults: ${passed} passed, ${failed} failed, ${skipped} skipped\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run();

'use strict';

const formatter = require('../src/telegram-ux/telegram-code-block-formatter');

let pass = 0;
let fail = 0;

function test(name, fn) {
  try {
    fn();
    pass++;
    console.log('  PASS:', name);
  } catch (e) {
    fail++;
    console.error('  FAIL:', name, '-', e.message);
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'assertion failed');
}

// Test formatCodeBlock
test('formatCodeBlock basic', () => {
  const result = formatter.formatCodeBlock('const x = 1;', 'js');
  assert(result.startsWith('```js'), 'Should start with language');
  assert(result.endsWith('```'), 'Should end with fence');
  assert(result.includes('const x = 1;'), 'Should contain code');
});

test('formatCodeBlock redacts secrets', () => {
  const result = formatter.formatCodeBlock('token = "sk-abc123def456"', 'js');
  assert(!result.includes('sk-abc123def456'), 'Should redact secret');
});

// Test formatShellCommandBlock
test('formatShellCommandBlock', () => {
  const result = formatter.formatShellCommandBlock('npm install');
  assert(result.startsWith('```bash'), 'Should be bash');
  assert(result.includes('npm install'), 'Should contain command');
});

// Test formatJsonBlock
test('formatJsonBlock', () => {
  const result = formatter.formatJsonBlock({ key: 'value' });
  assert(result.startsWith('```json'), 'Should be json');
  assert(result.includes('key'), 'Should contain key');
});

test('formatJsonBlock string', () => {
  const result = formatter.formatJsonBlock('{"a":1}');
  assert(result.startsWith('```'), 'Should have fence');
});

// Test formatDiffBlock
test('formatDiffBlock', () => {
  const result = formatter.formatDiffBlock('+added\n-removed');
  assert(result.startsWith('```diff'), 'Should be diff');
  assert(result.includes('+added'), 'Should contain added');
});

// Test trimHugeCodeBlock
test('trimHugeCodeBlock short code', () => {
  const result = formatter.trimHugeCodeBlock('short', 2000);
  assert(result === 'short', 'Short code should not be trimmed');
});

test('trimHugeCodeBlock long code', () => {
  const longCode = 'A'.repeat(5000);
  const result = formatter.trimHugeCodeBlock(longCode, 100);
  assert(result.length < 200, 'Should be trimmed');
  assert(result.includes('truncated'), 'Should mention truncation');
});

console.log(`\nResults: ${pass} passed, ${fail} failed\n`);
process.exit(fail > 0 ? 1 : 0);

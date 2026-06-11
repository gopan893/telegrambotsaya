'use strict';

const sanitizer = require('../src/telegram-ux/telegram-markdown-sanitizer');

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

// Test sanitizeTelegramMarkdown
test('sanitizeTelegramMarkdown basic', () => {
  const result = sanitizer.sanitizeTelegramMarkdown('Hello **bold** text');
  assert(result.includes('<b>'), 'Bold should be converted');
});

test('sanitizeTelegramMarkdown redacts secrets', () => {
  const result = sanitizer.sanitizeTelegramMarkdown('Token: sk-abc123def456');
  assert(!result.includes('sk-abc123def456'), 'Secret should be redacted');
  assert(result.includes('[REDACTED]'), 'Should show [REDACTED]');
});

test('sanitizeTelegramMarkdown protects code blocks', () => {
  const result = sanitizer.sanitizeTelegramMarkdown('```\ncode here\n```');
  assert(result.includes('```'), 'Code fences should be preserved');
});

// Test sanitizeTelegramHtml
test('sanitizeTelegramHtml basic', () => {
  const result = sanitizer.sanitizeTelegramHtml('<b>Bold</b> text');
  assert(result.includes('<b>'), 'Bold tag allowed');
});

test('sanitizeTelegramHtml strips dangerous tags', () => {
  const result = sanitizer.sanitizeTelegramHtml('<script>alert(1)</script>');
  assert(!result.includes('<script>'), 'Script tag should be removed');
});

// Test escapeTelegramMarkdown
test('escapeTelegramMarkdown', () => {
  const result = sanitizer.escapeTelegramMarkdown('Hello _world_');
  assert(result.includes('\\_'), 'Underscore should be escaped');
});

// Test detectFormattingRisk
test('detectFormattingRisk balanced', () => {
  const result = sanitizer.detectFormattingRisk('Normal text');
  assert(!result.risky, 'Normal text should not be risky');
});

test('detectFormattingRisk unbalanced code fence', () => {
  const result = sanitizer.detectFormattingRisk('```\ncode');
  assert(result.risky, 'Unclosed code fence should be risky');
  assert(result.reasons.includes('unclosed_code_fence'), 'Should detect unclosed fence');
});

// Test redactSecrets
test('redactSecrets bot token', () => {
  const result = sanitizer.redactSecrets('TELEGRAM_TOKEN=123456:ABC');
  assert(result.includes('[REDACTED]'), 'Should redact');
});

test('redactSecrets github token', () => {
  const result = sanitizer.redactSecrets('ghp_abc123def456');
  assert(result.includes('[REDACTED]'), 'Should redact ghp_ token');
});

test('redactSecrets api key', () => {
  const result = sanitizer.redactSecrets('api_key=supersecret123');
  assert(result.includes('[REDACTED]'), 'Should redact api_key');
});

console.log(`\nResults: ${pass} passed, ${fail} failed\n`);
process.exit(fail > 0 ? 1 : 0);

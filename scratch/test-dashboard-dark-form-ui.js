'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try { fn(); console.log(`\x1b[32m✅ ${name}\x1b[0m`); passed++; }
  catch (err) { console.log(`\x1b[31m❌ ${name}: ${err.message}\x1b[0m`); failed++; }
}

const cssPath = path.join(__dirname, '..', 'public', 'dashboard', 'styles.css');
const css = fs.readFileSync(cssPath, 'utf-8');

test('CSS contains global input dark styling', () => {
  const match = css.match(/input,\s*select,\s*textarea[^}]*\{/);
  assert.ok(match, 'Should have a combined CSS rule for input, select, textarea');
  assert.ok(css.includes('var(--bg-primary)'), 'Background should use dark variable');
});

test('No pure white background in form styles', () => {
  // Check that input/select/textarea rules use dark variables, not white
  const formSelectorBlock = css.match(/input,\s*select,\s*textarea[^}]*\{[^}]*\}/);
  assert.ok(formSelectorBlock, 'Input/select/textarea rule exists');
  assert.ok(!formSelectorBlock[0].includes('#fff') && !formSelectorBlock[0].includes('white'), 'Should not use white background');
});

test('CSS contains global select dark styling', () => {
  const match = css.match(/select[^}]*\{[^}]*background:/);
  assert.ok(match, 'Should have CSS rule for select with background');
});

test('CSS contains global textarea dark styling', () => {
  const match = css.match(/textarea[^}]*\{[^}]*background:/);
  assert.ok(match, 'Should have CSS rule for textarea with background');
});

test('CSS styles select option dark', () => {
  assert.ok(css.includes('select option'), 'Should style select option');
  assert.ok(css.includes('var(--bg-secondary)'), 'Option should use dark background');
});

test('CSS defines .form-control', () => {
  assert.ok(css.includes('.form-control'), '.form-control class should exist');
});

test('CSS defines .dashboard-input', () => {
  assert.ok(css.includes('.dashboard-input'), '.dashboard-input class should exist');
});

test('CSS defines .dashboard-select', () => {
  assert.ok(css.includes('.dashboard-select'), '.dashboard-select class should exist');
});

test('CSS defines .dashboard-textarea', () => {
  assert.ok(css.includes('.dashboard-textarea'), '.dashboard-textarea class should exist');
});

test('CSS defines .field, .field-label, .field-help', () => {
  assert.ok(css.includes('.field-label'), '.field-label class should exist');
  assert.ok(css.includes('.field-help'), '.field-help class should exist');
});

test('CSS defines .form-grid layout', () => {
  assert.ok(css.includes('.form-grid'), '.form-grid class should exist');
});

test('CSS defines .form-row layout', () => {
  assert.ok(css.includes('.form-row'), '.form-row class should exist');
});

test('CSS defines .form-stack layout', () => {
  assert.ok(css.includes('.form-stack'), '.form-stack class should exist');
});

test('CSS input focus uses accent glow', () => {
  assert.ok(css.includes('box-shadow: 0 0 0 3px var(--color-accent-glow)') || css.includes('border-color: var(--color-accent)'), 'Focus state should have accent glow');
});

test('CSS input/select/textarea border-radius is 14px', () => {
  const selectorBlock = css.match(/input[^}]*border-radius:\s*14px/);
  assert.ok(selectorBlock || css.includes('border-radius: 14px'), 'Border radius should be 14px');
});

console.log(`\n📊 Dark Form UI Test Results: ${passed} passed, ${failed} failed, ${passed+failed} total`);
if (failed > 0) process.exit(1);

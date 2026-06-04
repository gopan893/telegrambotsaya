/**
 * test-dashboard-dark-form-ui.js
 * Tests that all form controls use dark theme styles.
 * Run: node scratch/test-dashboard-dark-form-ui.js
 */
var path = require('path');
var fs = require('fs');

var stylesCssPath = path.join(__dirname, '..', 'public', 'dashboard', 'styles.css');
var mobileCssPath = path.join(__dirname, '..', 'public', 'dashboard', 'mobile.css');

var stylesCss = fs.readFileSync(stylesCssPath, 'utf-8');
var mobileCss = fs.readFileSync(mobileCssPath, 'utf-8');

var passed = 0;
var failed = 0;

function assert(condition, msg) {
  if (condition) {
    console.log('  PASS: ' + msg);
    passed++;
  } else {
    console.error('  FAIL: ' + msg);
    failed++;
  }
}

console.log('\n=== Dark Form UI Test ===\n');

// All form elements must be styled dark
var formElements = ['input', 'select', 'textarea'];
console.log('--- Native form elements styled ---\n');
for (var i = 0; i < formElements.length; i++) {
  var el = formElements[i];
  assert(stylesCss.indexOf(el + ',') !== -1 || stylesCss.indexOf(el + ' {') !== -1,
    'CSS styles raw "' + el + '"');
  assert(stylesCss.indexOf(el + ':focus') !== -1, el + ':focus state exists');
  if (el !== 'select') {
    assert(stylesCss.indexOf(el + '::placeholder') !== -1, el + ' placeholder styled');
  }
}

console.log('\n--- Dashboard form classes styled ---\n');
var formClasses = ['.form-control', '.dashboard-input', '.dashboard-select', '.dashboard-textarea'];
for (var j = 0; j < formClasses.length; j++) {
  var cls = formClasses[j];
  assert(stylesCss.indexOf(cls) !== -1, 'CSS has class "' + cls + '"');
}

console.log('\n--- No white backgrounds ---\n');
assert(stylesCss.indexOf('background: var(--bg-primary)') !== -1, 'Input uses dark background var');
assert(stylesCss.indexOf('color: var(--text-primary)') !== -1, 'Input uses light text var');

var whitePatterns = ['background: #fff', 'background: #ffffff', 'background: white',
  'background-color: #fff', 'background-color: #ffffff', 'background-color: white'];
for (var w = 0; w < whitePatterns.length; w++) {
  var lines = stylesCss.split('\n');
  var inFormBlock = false;
  var whiteFound = false;
  for (var l = 0; l < lines.length; l++) {
    var line = lines[l];
    if (line.indexOf('input') !== -1 || line.indexOf('select') !== -1 || line.indexOf('textarea') !== -1 ||
        line.indexOf('.form-control') !== -1 || line.indexOf('.dashboard-') !== -1) {
      inFormBlock = true;
    } else if (line.indexOf('}') !== -1) {
      inFormBlock = false;
    }
    if (inFormBlock && line.indexOf(whitePatterns[w]) !== -1) {
      whiteFound = true;
    }
  }
  assert(!whiteFound, 'No white background "' + whitePatterns[w] + '" in form styles');
}

console.log('\n--- Border color and focus ---\n');
assert(stylesCss.indexOf('border-color') !== -1, 'Form elements have border-color');
assert(stylesCss.indexOf('box-shadow') !== -1, 'Form focus has box-shadow');

console.log('\n--- Placeholder visibility ---\n');
assert(stylesCss.indexOf('placeholder') !== -1, 'Placeholder styling exists');
assert(stylesCss.indexOf('var(--text-muted)') !== -1, 'Placeholder uses muted text color');

console.log('\n--- Option/dropdown styling ---\n');
assert(stylesCss.indexOf('select option') !== -1, 'Select option styled');

console.log('\n--- Autofill override ---\n');
assert(stylesCss.indexOf('-webkit-autofill') !== -1, 'Autofill override exists');
assert(stylesCss.indexOf('-webkit-text-fill-color') !== -1, 'Autofill text color override');

console.log('\n--- Mobile form width 100% ---\n');
assert(mobileCss.indexOf('width: 100%') !== -1, 'Mobile forms width 100%');

console.log('\n========================================');
console.log('Total: ' + (passed + failed) + ' | PASS: ' + passed + ' | FAIL: ' + failed + '\n');
process.exit(failed > 0 ? 1 : 0);

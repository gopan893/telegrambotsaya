'use strict';

const { recipeVariableInterpolator } = require('../src/recipes');

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL:', msg); } }

async function run() {
  // interpolate resolves $variables
  const r1 = recipeVariableInterpolator.interpolate('Hello $name', { name: 'World' });
  assert(r1 === 'Hello World', 'interpolate simple variable');

  // interpolate preserves unmatched variables
  const r2 = recipeVariableInterpolator.interpolate('Hello $unknown', {});
  assert(r2 === 'Hello $unknown', 'interpolate preserves unmatched');

  // interpolate resolves variables from flat keys
  const r3 = recipeVariableInterpolator.interpolate('Hello $name', { name: 'Alice' });
  assert(r3 === 'Hello Alice', 'interpolate flat variable');

  // resolveVariablePath handles nested dot notation
  const rp1 = recipeVariableInterpolator.resolveVariablePath('user.name', { user: { name: 'Bob' } });
  assert(rp1 === 'Bob', 'resolveVariablePath nested dot notation');

  // interpolate objects
  const r5 = recipeVariableInterpolator.interpolate({ key: 'Hello $name', num: 42 }, { name: 'World' });
  assert(r5.key === 'Hello World', 'interpolate object values');
  assert(r5.num === 42, 'interpolate preserves non-string values');

  // interpolate arrays
  const r6 = recipeVariableInterpolator.interpolate(['Hello $name', 'Static'], { name: 'World' });
  assert(r6[0] === 'Hello World', 'interpolate array elements');
  assert(r6[1] === 'Static', 'interpolate preserves static array elements');

  // interpolate nested objects and arrays
  const r7 = recipeVariableInterpolator.interpolate(
    { items: ['$first', '$second'], meta: { title: '$title' } },
    { first: 'a', second: 'b', title: 'My Title' }
  );
  assert(r7.items[0] === 'a', 'interpolate nested array item');
  assert(r7.items[1] === 'b', 'interpolate second array item');
  assert(r7.meta.title === 'My Title', 'interpolate nested object field');

  // resolveVariablePath
  const v1 = recipeVariableInterpolator.resolveVariablePath('user.name', { user: { name: 'Bob' } });
  assert(v1 === 'Bob', 'resolveVariablePath simple');
  const v2 = recipeVariableInterpolator.resolveVariablePath('a.b.c', { a: { b: { c: 'val' } } });
  assert(v2 === 'val', 'resolveVariablePath deep');
  const v3 = recipeVariableInterpolator.resolveVariablePath('missing', {});
  assert(v3 === undefined, 'resolveVariablePath missing returns undefined');

  // buildVariableContext
  const ctx = recipeVariableInterpolator.buildVariableContext({ global: 'g' }, { local: 'l' });
  assert(ctx.global === 'g', 'buildVariableContext includes global');
  assert(ctx.local === 'l', 'buildVariableContext includes local');

  // local overrides global
  const ctx2 = recipeVariableInterpolator.buildVariableContext({ key: 'global' }, { key: 'local' });
  assert(ctx2.key === 'local', 'buildVariableContext local overrides global');

  console.log('Result: ' + pass + ' PASS, ' + fail + ' FAIL');
  process.exit(fail ? 1 : 0);
}
run().catch(e => { console.error('Test error:', e); process.exit(1); });

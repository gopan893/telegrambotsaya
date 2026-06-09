'use strict';

const { recipeConditionEngine } = require('../src/recipes');

let pass = 0, fail = 0;
function assert(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL:', msg); } }

async function run() {
  // equals
  const eqMatch = recipeConditionEngine.evaluateCondition({ type: 'equals', field: '$status', value: 'active' }, { status: 'active' });
  assert(eqMatch.matched === true, 'equals matched');
  const eqFail = recipeConditionEngine.evaluateCondition({ type: 'equals', field: '$status', value: 'inactive' }, { status: 'active' });
  assert(eqFail.matched === false, 'equals not matched');

  // contains
  const ctMatch = recipeConditionEngine.evaluateCondition({ type: 'contains', field: '$text', value: 'hello' }, { text: 'hello world' });
  assert(ctMatch.matched === true, 'contains matched');
  const ctFail = recipeConditionEngine.evaluateCondition({ type: 'contains', field: '$text', value: 'bye' }, { text: 'hello world' });
  assert(ctFail.matched === false, 'contains not matched');

  // greater_than
  const gtMatch = recipeConditionEngine.evaluateCondition({ type: 'greater_than', field: '$count', value: 5 }, { count: 10 });
  assert(gtMatch.matched === true, 'greater_than matched');
  const gtFail = recipeConditionEngine.evaluateCondition({ type: 'greater_than', field: '$count', value: 10 }, { count: 5 });
  assert(gtFail.matched === false, 'greater_than not matched');

  // less_than
  const ltMatch = recipeConditionEngine.evaluateCondition({ type: 'less_than', field: '$count', value: 10 }, { count: 5 });
  assert(ltMatch.matched === true, 'less_than matched');
  const ltFail = recipeConditionEngine.evaluateCondition({ type: 'less_than', field: '$count', value: 5 }, { count: 10 });
  assert(ltFail.matched === false, 'less_than not matched');

  // regex
  const rxMatch = recipeConditionEngine.evaluateCondition({ type: 'regex', field: '$email', value: '^test@' }, { email: 'test@example.com' });
  assert(rxMatch.matched === true, 'regex matched');
  const rxFail = recipeConditionEngine.evaluateCondition({ type: 'regex', field: '$email', value: '^nope@' }, { email: 'test@example.com' });
  assert(rxFail.matched === false, 'regex not matched');

  // exists
  const exMatch = recipeConditionEngine.evaluateCondition({ type: 'exists', field: '$present' }, { present: 'yes' });
  assert(exMatch.matched === true, 'exists matched');
  const exFail = recipeConditionEngine.evaluateCondition({ type: 'exists', field: '$missing' }, {});
  assert(exFail.matched === false, 'exists not matched');

  // boolean
  const boolMatch = recipeConditionEngine.evaluateCondition({ type: 'boolean', field: '$flag', value: true }, { flag: true });
  assert(boolMatch.matched === true, 'boolean matched');
  const boolFail = recipeConditionEngine.evaluateCondition({ type: 'boolean', field: '$flag', value: true }, { flag: false });
  assert(boolFail.matched === false, 'boolean not matched');

  // and
  const andMatch = recipeConditionEngine.evaluateCondition({ type: 'and', conditions: [
    { type: 'equals', field: '$a', value: 1 },
    { type: 'equals', field: '$b', value: 2 }
  ]}, { a: 1, b: 2 });
  assert(andMatch.matched === true, 'and matched');
  const andFail = recipeConditionEngine.evaluateCondition({ type: 'and', conditions: [
    { type: 'equals', field: '$a', value: 1 },
    { type: 'equals', field: '$b', value: 99 }
  ]}, { a: 1, b: 2 });
  assert(andFail.matched === false, 'and not matched');

  // or
  const orMatch = recipeConditionEngine.evaluateCondition({ type: 'or', conditions: [
    { type: 'equals', field: '$a', value: 1 },
    { type: 'equals', field: '$b', value: 99 }
  ]}, { a: 1, b: 2 });
  assert(orMatch.matched === true, 'or matched');
  const orFail = recipeConditionEngine.evaluateCondition({ type: 'or', conditions: [
    { type: 'equals', field: '$a', value: 99 },
    { type: 'equals', field: '$b', value: 98 }
  ]}, { a: 1, b: 2 });
  assert(orFail.matched === false, 'or not matched');

  // not
  const notMatch = recipeConditionEngine.evaluateCondition({ type: 'not', condition: { type: 'equals', field: '$x', value: 1 } }, { x: 2 });
  assert(notMatch.matched === true, 'not matched (negation)');
  const notFail = recipeConditionEngine.evaluateCondition({ type: 'not', condition: { type: 'equals', field: '$x', value: 1 } }, { x: 1 });
  assert(notFail.matched === false, 'not not matched');

  // default / unknown type
  const unknown = recipeConditionEngine.evaluateCondition({ type: 'nonexistent' }, {});
  assert(unknown.matched === false && unknown.error, 'unknown type returns error');

  console.log('Result: ' + pass + ' PASS, ' + fail + ' FAIL');
  process.exit(fail ? 1 : 0);
}
run().catch(e => { console.error('Test error:', e); process.exit(1); });

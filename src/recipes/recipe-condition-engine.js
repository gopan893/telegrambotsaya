'use strict';

function evaluateCondition(condition, context = {}) {
  if (!condition || !condition.type) return { matched: true };
  switch (condition.type) {
    case 'equals':
      return evaluateEquals(condition, context);
    case 'contains':
      return evaluateContains(condition, context);
    case 'greater_than':
      return evaluateGreaterThan(condition, context);
    case 'less_than':
      return evaluateLessThan(condition, context);
    case 'regex':
      return evaluateRegex(condition, context);
    case 'exists':
      return evaluateExists(condition, context);
    case 'boolean':
      return evaluateBoolean(condition, context);
    case 'and':
      return evaluateAnd(condition, context);
    case 'or':
      return evaluateOr(condition, context);
    case 'not':
      return evaluateNot(condition, context);
    default:
      return { matched: false, error: `Unknown condition type: ${condition.type}` };
  }
}

function resolveValue(expr, context) {
  if (typeof expr === 'string' && expr.startsWith('$')) {
    const path = expr.slice(1).split('.');
    let val = context;
    for (const key of path) {
      if (val === undefined || val === null) return undefined;
      val = val[key];
    }
    return val;
  }
  return expr;
}

function evaluateEquals(condition, context) {
  const actual = resolveValue(condition.field, context);
  const expected = resolveValue(condition.value, context);
  return { matched: actual === expected, expected, actual };
}

function evaluateContains(condition, context) {
  const actual = String(resolveValue(condition.field, context) || '');
  const substr = String(resolveValue(condition.value, context) || '');
  return { matched: actual.includes(substr) };
}

function evaluateGreaterThan(condition, context) {
  const actual = Number(resolveValue(condition.field, context) || 0);
  const threshold = Number(resolveValue(condition.value, context) || 0);
  return { matched: actual > threshold, actual, threshold };
}

function evaluateLessThan(condition, context) {
  const actual = Number(resolveValue(condition.field, context) || 0);
  const threshold = Number(resolveValue(condition.value, context) || 0);
  return { matched: actual < threshold, actual, threshold };
}

function evaluateRegex(condition, context) {
  const actual = String(resolveValue(condition.field, context) || '');
  try {
    const regex = new RegExp(condition.pattern || condition.value, 'i');
    return { matched: regex.test(actual) };
  } catch { return { matched: false, error: 'Invalid regex' }; }
}

function evaluateExists(condition, context) {
  const val = resolveValue(condition.field, context);
  return { matched: val !== undefined && val !== null && val !== '' };
}

function evaluateBoolean(condition, context) {
  const val = resolveValue(condition.field, context);
  return { matched: Boolean(val) === Boolean(condition.value) };
}

function evaluateAnd(condition, context) {
  const conditions = condition.conditions || [];
  const results = conditions.map(c => evaluateCondition(c, context));
  return { matched: results.every(r => r.matched), subResults: results };
}

function evaluateOr(condition, context) {
  const conditions = condition.conditions || [];
  const results = conditions.map(c => evaluateCondition(c, context));
  return { matched: results.some(r => r.matched), subResults: results };
}

function evaluateNot(condition, context) {
  const sub = evaluateCondition(condition.condition || condition, context);
  return { matched: !sub.matched, subResult: sub };
}

module.exports = { evaluateCondition };

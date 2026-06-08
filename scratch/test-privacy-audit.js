'use strict';

const pa = require('../src/privacy/privacy-audit');

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) { passed++; }
  else { console.error('FAIL:', msg); failed++; }
}

// Test recordPrivacyAudit stores event
const event = pa.recordPrivacyAudit({ type: 'data_access', userId: 'user1', details: { category: 'telegram_messages' } });
assert(event, 'event recorded');
assert(event.id, 'event has id');
assert(event.type === 'data_access', 'event type correct');
assert(event.timestamp, 'event has timestamp');

// Test recordPrivacyAudit sanitizes secrets in details
const secretEvent = pa.recordPrivacyAudit({ type: 'test', userId: 'user2', details: { token: 'ghp_abc12345def' } });
assert(secretEvent.details.redacted === true, 'secrets redacted in details');

// Test recordPrivacyAudit returns null for no event
const nullEvent = pa.recordPrivacyAudit(null);
assert(nullEvent === null, 'null event returns null');

// Test listPrivacyAudit filters correctly
const allEvents = pa.listPrivacyAudit();
assert(allEvents.length >= 2, 'listPrivacyAudit returns stored events');

const filteredEvents = pa.listPrivacyAudit({ type: 'data_access' });
assert(filteredEvents.length === 1, 'filter by type works');

const userFiltered = pa.listPrivacyAudit({ userId: 'user2' });
assert(userFiltered.length === 1, 'filter by userId works');

// Test listPrivacyAudit with limit
const limited = pa.listPrivacyAudit({ limit: 1 });
assert(limited.length <= 1, 'limit works');

// Test sanitizePrivacyAuditEvent redacts secrets
const safeEvent = pa.sanitizePrivacyAuditEvent({ type: 'safe', details: { name: 'test' } });
assert(safeEvent.details.name === 'test', 'safe event not redacted');

const sanitizedEvent = pa.sanitizePrivacyAuditEvent({ type: 'unsafe', details: { secret: 'password123' } });
assert(sanitizedEvent.details.redacted === true, 'unsafe event redacted');

// Test sanitizePrivacyAuditEvent returns null
assert(pa.sanitizePrivacyAuditEvent(null) === null, 'sanitize null returns null');

// Test summarizePrivacyAudit returns byType counts
const summary = pa.summarizePrivacyAudit();
assert(summary.total >= 2, 'summary total is at least 2');
assert(summary.byType, 'summary has byType');
assert(typeof summary.byType.data_access === 'number', 'byType has data_access count');

console.log(`\nResults: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);

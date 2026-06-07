'use strict';

const assert = require('assert');
const lifeos = require('../src/lifeos');

function services() {
  return { __lifeosStore: {}, workspaceId: 'ws_life', userId: 'user_life', actorType: 'test' };
}

(async () => {
  const svc = services();
  const classification = lifeos.lifeMemoryGovernance.classifyLifeMemoryCandidate({ text: 'ingat saya ingin belajar malam' }, svc);
  assert.equal(classification.shouldStore, true);

  const stored = await lifeos.lifeMemoryGovernance.storeSafeLifeMemory({ text: 'ingat saya ingin belajar malam' }, svc);
  assert.equal(stored.ok, true);
  assert.equal(stored.stored, true);

  const privateNote = await lifeos.lifeMemoryGovernance.storeSafeLifeMemory({ text: 'mood saya capek', title: 'Private mood' }, svc);
  assert.equal(privateNote.stored, true);
  assert.equal(privateNote.memory.sensitivity, 'private');

  const context = await lifeos.lifeMemoryGovernance.retrieveLifeContext('mood', svc);
  assert.equal(context.ok, true);
  assert.ok(context.items.some((item) => item.summary === '[PRIVATE_LIFE_CONTEXT]'));

  const archived = await lifeos.lifeMemoryGovernance.archiveSensitiveLifeMemory(privateNote.memory.id, svc);
  assert.equal(archived.memory.status, 'archived');

  const blocked = await lifeos.lifeMemoryGovernance.storeSafeLifeMemory({ text: 'TELEGRAM_TOKEN=abc123' }, svc);
  assert.equal(blocked.allowed, false);

  console.log('test-life-memory-governance: ok');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});

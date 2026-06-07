'use strict';

const assert = require('assert');
const lifeos = require('../src/lifeos');

function services() {
  return { __lifeosStore: {}, workspaceId: 'ws_life', userId: 'user_life', actorType: 'test' };
}

(async () => {
  const svc = services();
  const note = await lifeos.energyMoodJournal.createEnergyMoodNote({ note: 'Capek hari ini', energyLevel: 2, mood: 'tired' }, svc);
  assert.equal(note.ok, true);
  assert.equal(note.note.sensitivity, 'private');
  assert.ok(note.supportiveMessage.includes('Dicatat'));

  const trend = await lifeos.energyMoodJournal.summarizeEnergyTrend({}, svc);
  assert.equal(trend.totalNotes, 1);
  assert.equal(trend.averageEnergy, 2);

  const burnout = lifeos.energyMoodJournal.detectBurnoutWarningSigns([
    { note: 'capek', energyLevel: 1 },
    { note: 'lelah', energyLevel: 2 },
    { note: 'stres', energyLevel: 2 }
  ]);
  assert.equal(burnout.warning, true);
  assert.ok(burnout.note.includes('bukan diagnosis'));

  const recovery = await lifeos.energyMoodJournal.suggestGentleRecoveryPlan(svc);
  assert.equal(recovery.ok, true);
  assert.ok(recovery.medicalDisclaimer);

  const blocked = await lifeos.energyMoodJournal.createEnergyMoodNote({ note: 'token=abc123' }, svc);
  assert.equal(blocked.ok, false);

  console.log('test-energy-mood-journal: ok');
})().catch((err) => {
  console.error(err);
  process.exit(1);
});

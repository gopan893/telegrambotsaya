'use strict';

const assert = require('assert');
const detector = require('../src/agents/agent-action-detector');

(() => {
  const backup = detector.detectActionIntent('jalankan backup sekarang');
  assert.equal(backup.hasActionIntent, true);
  assert.equal(backup.actionType, 'backup.create');
  assert.equal(backup.requiresApproval, true);

  const restore = detector.detectActionIntent('restore backup lama');
  assert.equal(restore.actionType, 'restore.run');
  assert.equal(restore.riskLevel, 'danger');

  const task = detector.detectActionIntent('tandai task task_123 selesai');
  assert.equal(task.actionType, 'planner.task.mark_done');
  assert.equal(task.targetId, 'task_123');

  const simple = detector.detectActionIntent('Halo');
  assert.equal(simple.hasActionIntent, false);

  console.log('test-agent-action-detector: ok');
})();

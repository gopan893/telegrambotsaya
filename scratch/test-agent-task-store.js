'use strict';

const assert = require('assert');
const agents = require('../src/agents');

function services() {
  const mem = {};
  const audits = [];
  return {
    __agentMemory: mem,
    storageManager: {
      safeRead: async (key, fallback) => Object.prototype.hasOwnProperty.call(mem, key) ? mem[key] : fallback,
      safeWrite: async (key, value) => { mem[key] = value; return value; }
    },
    auditLog: { items: audits, async recordAuditLog(entry) { audits.push(entry); return entry; } }
  };
}

(async () => {
  const svc = services();
  const task = await agents.agentTaskStore.createTask({
    workspaceId: 'w1',
    userId: 'u1',
    title: 'Review deployment',
    description: 'Cek Render deploy dan PostgreSQL fallback',
    type: 'ops_check'
  }, svc);
  assert.strictEqual(task.workspaceId, 'w1');
  assert.strictEqual((await agents.agentTaskStore.getTask(task.id, svc)).id, task.id);
  const updated = await agents.agentTaskStore.updateTask(task.id, { status: 'queued' }, svc);
  assert.strictEqual(updated.status, 'queued');
  const listed = await agents.agentTaskStore.listTasks({ workspaceId: 'w1' }, svc);
  assert.strictEqual(listed.length, 1);
  await agents.agentTaskQueue.markAgentTaskCompleted(task.id, { summary: 'Done', confidence: 0.7 }, svc);
  const archived = await agents.agentTaskStore.archiveTask(task.id, { actorId: 'u1' }, svc);
  assert.strictEqual(archived.status, 'archived');
  await assert.rejects(() => agents.agentTaskStore.createTask({ title: 'token=abc123secret' }, svc), /AGENT_TASK_SECRET_REJECTED/);
  assert.ok(svc.auditLog.items.some(item => item.action === 'agents/agent_task_created'));

  console.log('test-agent-task-store: ok');
})();

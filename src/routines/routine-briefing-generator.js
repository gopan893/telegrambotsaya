'use strict';

const utils = require('./routine-utils');

function createRoutineBriefingGenerator(services = {}) {
  const auditLog = services.auditLog || [];
  const opsSystem = services.opsSystem || null;
  const storageManager = services.storageManager || null;
  const registry = services.registry || null;

  function getStore() {
    return registry?.routineStore || null;
  }

  async function generateDailyBriefing(userId, workspaceId, svc) {
    const store = getStore();
    const sections = [];

    // Goals/Tasks section
    try {
      const tasks = svc.getUserTasks?.(userId) || [];
      const pending = tasks.filter(t => !t.done);
      sections.push({
        title: '📋 Pending Tasks',
        content: pending.length > 0
          ? pending.slice(0, 5).map(t => `- ${t.text}`).join('\n')
          : 'No pending tasks'
      });
    } catch (_) {
      sections.push({ title: '📋 Tasks', content: 'Unavailable' });
    }

    // Pending proposals
    try {
      const pendingProp = store?.listProposals ? store.listProposals({}) : [];
      sections.push({
        title: '⏳ Pending Proposals',
        content: pendingProp.length > 0
          ? `${pendingProp.length} proposal(s) pending`
          : 'No pending proposals'
      });
    } catch (_) {
      sections.push({ title: '⏳ Proposals', content: 'Unavailable' });
    }

    // Routine status
    const routines = store?.listRoutines ? store.listRoutines({ enabled: true }) : [];
    const dueRoutines = routines.filter(r => r.schedule !== 'manual' && r.nextRunAt && new Date(r.nextRunAt) <= new Date());
    sections.push({
      title: '🔄 Routines',
      content: `${routines.length} active, ${dueRoutines.length} due today`
    });

    // Storage health
    try {
      const health = storageManager?.getStorageStatus?.() || {};
      sections.push({
        title: '💾 Storage',
        content: `Driver: ${health.driver || health.persistentType || 'unknown'}, Redis: ${health.redisAvailable ? '✅' : '❌'}`
      });
    } catch (_) {
      sections.push({ title: '💾 Storage', content: 'Unavailable' });
    }

    const summary = sections.map(s => `**${s.title}**\n${s.content}`).join('\n\n');

    auditLog.push({ type: 'briefing_generated', userId, type: 'daily', timestamp: utils.nowIso() });

    return {
      summary: utils.sanitizeOutput(summary),
      sections,
      generatedAt: utils.nowIso()
    };
  }

  async function generateWeeklyRoadmapReview(userId, workspaceId, svc) {
    const sections = [];

    sections.push({
      title: '🗺️ Current Phase',
      content: 'Phase 31 - Approved Routine Automation Loop'
    });

    sections.push({
      title: '📈 Progress',
      content: 'System stabilized with Phase 30. Routine automation in progress.'
    });

    sections.push({
      title: '🎯 Recommended Next Steps',
      content: '1. Complete routine integration\n2. Add more dashboard panels\n3. Run comprehensive tests'
    });

    const summary = sections.map(s => `**${s.title}**\n${s.content}`).join('\n\n');

    return {
      summary: utils.sanitizeOutput(summary),
      sections,
      generatedAt: utils.nowIso()
    };
  }

  async function generateOpsBriefing(userId, workspaceId, svc) {
    const sections = [];

    try {
      const health = svc.getHealth?.() || {};
      sections.push({
        title: '🩺 System Health',
        content: `Status: ${health.ok ? 'Healthy ✅' : 'Degraded ⚠️'}\nUptime: ${Math.floor(health.uptime || 0 / 60)} min`
      });
    } catch (_) {
      sections.push({ title: '🩺 Health', content: 'Unavailable' });
    }

    const summary = sections.map(s => `**${s.title}**\n${s.content}`).join('\n\n');
    return { summary: utils.sanitizeOutput(summary), sections, generatedAt: utils.nowIso() };
  }

  async function generateCodingBriefing(userId, workspaceId, svc) {
    const sections = [{
      title: '💻 Coding Workspace',
      content: 'Check dashboard for latest coding tasks and change plans.'
    }];
    const summary = sections.map(s => `**${s.title}**\n${s.content}`).join('\n\n');
    return { summary: utils.sanitizeOutput(summary), sections, generatedAt: utils.nowIso() };
  }

  async function generateIntegrationBriefing(userId, workspaceId, svc) {
    const sections = [{
      title: '🔌 Integrations',
      content: 'All integrations are proposal-only. Check dashboard for status.'
    }];
    const summary = sections.map(s => `**${s.title}**\n${s.content}`).join('\n\n');
    return { summary: utils.sanitizeOutput(summary), sections, generatedAt: utils.nowIso() };
  }

  async function generatePendingProposalBriefing(userId, workspaceId, svc) {
    const store = getStore();
    const proposals = store?.listProposals ? store.listProposals({}) : [];
    const sections = [{
      title: '⏳ Pending Proposals Summary',
      content: proposals.length > 0
        ? proposals.map(p => `- ${p.action || 'Unknown'} (${p.riskLevel || 'low'})`).join('\n')
        : 'No pending proposals'
    }];
    const summary = sections.map(s => `**${s.title}**\n${s.content}`).join('\n\n');
    return { summary: utils.sanitizeOutput(summary), sections, generatedAt: utils.nowIso() };
  }

  return {
    generateDailyBriefing,
    generateWeeklyRoadmapReview,
    generateOpsBriefing,
    generateCodingBriefing,
    generateIntegrationBriefing,
    generatePendingProposalBriefing
  };
}

module.exports = { createRoutineBriefingGenerator };

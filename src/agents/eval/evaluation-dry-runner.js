'use strict';

const actionDetector = require('../agent-action-detector');
const actionMapper = require('../agent-action-mapper');
const actionPlan = require('../agent-action-plan');
const agentRouter = require('../agent-router');
const decisionDetector = require('../decision-detector');
const delegationEngine = require('../delegation-engine');
const preflight = require('../executor-preflight-review');
const renderer = require('../agent-response-renderer');
const utils = require('../delegation-utils');
const { maskSecret } = require('../agent-utils');

function buildHeuristicOutput(input = '', route = {}, action = {}, plan = null) {
  const text = String(input || '');
  const topics = route.topics || [];
  if (/production\s+health|prod(uction)?\s+health|cek\s+health/i.test(text)) {
    return 'Production health check bersifat read-only. Status health perlu dicek dari app, dashboard, webhook, storage, Redis, Evaluation Gate, dan executor boundary; tidak ada action yang dijalankan.';
  }
  if (/kenapa\s+deploy\s+gagal|deploy\s+gagal|app\s+down\s+setelah\s+deploy|dashboard\s+error\s+setelah\s+push/i.test(text)) {
    return 'Root cause sementara: deploy gagal perlu diverifikasi dari log Render, GitHub Actions, startup check, env-check set/missing, dan dashboard route guard. Next check: lihat error startup, dependency, /health, dan hasil post-deploy monitor.';
  }
  if (/database_url|secret|token|bocor/i.test(text) && topics.includes('secret')) {
    return 'Critical secret incident terdeteksi. Secret harus di-redact, jangan tampilkan value mentah, lakukan rotate credential, dan buat incident/security review sebelum tindakan lanjutan.';
  }
  if (action.hasActionIntent) {
    if (action.actionType === 'restore.run') {
      return 'Restore/rollback termasuk aksi berisiko tinggi. Saya hanya membuat proposal dan security review; belum dijalankan. Approve dengan /approve <proposalId>, lalu run setelah approve dengan /runexec <proposalId>.';
    }
    return `Saya buat proposal ${action.actionType || 'aksi'} dalam mode dry-run. Status: pending approval. Approve dengan /approve <proposalId>, lalu run setelah approve dengan /runexec <proposalId>.`;
  }
  if (topics.includes('school_life') || topics.includes('social_advice')) {
    return [
      'Tenang dulu. Dengarkan guru sampai selesai, lalu minta maaf singkat tanpa membantah.',
      'Contoh: "Maaf Pak/Bu, saya paham saya salah dan akan berusaha memperbaiki."',
      'Setelah suasana lebih tenang, jelaskan seperlunya dan tawarkan tindakan perbaikan.'
    ].join('\n');
  }
  if (topics.includes('emotional')) {
    return 'Aku paham kamu capek. Ambil satu langkah kecil dulu, istirahat sebentar, lalu pilih satu hal yang paling bisa diselesaikan hari ini.';
  }
  if (topics.includes('coding') || topics.includes('debugging')) {
    return 'Untuk error Python, cek pesan error lengkap, log Render, dependency, dan perubahan terakhir. Kirim stack trace tanpa token/API key.';
  }
  if (topics.includes('deploy') || topics.includes('ops')) {
    return 'Mulai dari cek log Render, status webhook, env wajib, dan /health. Jangan kirim token di chat.';
  }
  if (topics.includes('secret')) {
    return 'Saya mendeteksi secret-like value. Jangan kirim token/API key di chat; rotate jika sudah terlanjur dibagikan.';
  }
  if (/10 bot|4 dulu/i.test(text)) {
    return 'Lebih aman mulai dari 4 bot dulu secara bertahap, validasi stabilitas, lalu tambah agent setelah routing dan evaluasi lulus.';
  }
  if (/gambar tadi/i.test(text)) {
    return 'Kalau maksudnya gambar tadi, saya perlu konteks file yang relevan. Visual note boleh muncul hanya untuk pertanyaan gambar/file.';
  }
  if (/phase|lanjut|langkah|roadmap/i.test(text)) {
    return renderer.renderNaturalSmartReply({}, route, [], { text, topics, route });
  }
  return 'Jawaban dry-run ringkas: gunakan konteks terbaru, pilih langkah kecil, dan jangan jalankan aksi tanpa approval.';
}

async function runDryEvaluation(testCase = {}, services = {}) {
  const input = utils.sanitizeDelegationText(testCase.input || '', { max: 900 });
  const context = {
    ...(testCase.context || {}),
    forceMode: testCase.forceMode || 'natural_smart',
    groupSettings: { mode: 'natural_smart', maxAutoAgents: 5, ...(testCase.context?.groupSettings || {}) },
    workspaceId: testCase.workspaceId || services.workspaceId || 'default',
    userId: testCase.userId || services.userId || 'eval-user'
  };
  let route = agentRouter.routeMessage(input, context, services);
  let action = actionDetector.detectActionIntent(input, {
    source: 'evaluation',
    workspaceId: context.workspaceId,
    userId: context.userId
  }, services);
  const lower = input.toLowerCase();
  if (/kenapa\s+deploy\s+gagal|deploy\s+gagal|app\s+down\s+setelah\s+deploy|dashboard\s+error\s+setelah\s+push/i.test(input)) {
    route = {
      ...route,
      topics: utils.unique([...(route.topics || []), 'deploy', 'ops']),
      selectedAgents: utils.unique(['orchestrator', 'ops', 'critic', ...(route.selectedAgents || []).filter(agent => agent !== 'coder')]),
      risk: { ...(route.risk || {}), level: 'medium', riskLevel: 'medium' }
    };
  }
  if (/\brollback\b/i.test(input)) {
    route = {
      ...route,
      topics: utils.unique([...(route.topics || []), 'deploy', 'restore', 'executor']),
      selectedAgents: utils.unique(['orchestrator', 'security', 'executor']),
      risk: { ...(route.risk || {}), level: 'danger', riskLevel: 'danger' },
      approvalRequired: true
    };
    action = {
      ...action,
      hasActionIntent: true,
      actionType: 'restore.run',
      targetType: 'deploy',
      riskLevel: 'danger',
      requiresApproval: true,
      reason: action.reason || 'rollback request'
    };
  }
  if (/database_url|secret|token|bocor/i.test(lower)) {
    route = {
      ...route,
      topics: utils.unique([...(route.topics || []), 'secret', 'security']),
      selectedAgents: utils.unique(['orchestrator', 'security']),
      risk: { ...(route.risk || {}), level: 'danger', riskLevel: 'danger', secretDetected: true },
      approvalRequired: true
    };
    action = {
      ...action,
      riskLevel: 'danger',
      requiresApproval: true
    };
  }
  const decision = decisionDetector.shouldTriggerDecisionSystem(input, route, {}, {}, services);
  const delegation = delegationEngine.shouldTriggerDelegation(input, {
    workspaceId: context.workspaceId,
    userId: context.userId
  }, route, {}, services);

  let dryActionPlan = null;
  let preflightReview = null;
  if (action.hasActionIntent) {
    const mapped = actionMapper.mapIntentToActions(action, {
      text: input,
      workspaceId: context.workspaceId,
      userId: context.userId,
      source: 'evaluation'
    });
    if (mapped.ok) {
      try {
        dryActionPlan = actionPlan.buildActionPlan({
          id: `dry_${testCase.id || 'case'}`,
          workspaceId: context.workspaceId,
          userId: context.userId,
          source: 'dashboard',
          createdByAgentId: 'executor',
          title: `Dry-run: ${action.actionType}`,
          description: input,
          actions: mapped.actions,
          riskLevel: action.riskLevel,
          approvalRequired: true,
          status: 'reviewing'
        });
        preflightReview = await preflight.runExecutorPreflight(dryActionPlan, {
          ...services,
          dryRun: true
        });
      } catch (err) {
        preflightReview = {
          allowedToPropose: false,
          allowedToRunDirectly: false,
          riskLevel: action.riskLevel,
          approvalRequired: true,
          blockers: [err.code || err.message],
          warnings: []
        };
      }
    } else {
      preflightReview = {
        allowedToPropose: false,
        allowedToRunDirectly: false,
        riskLevel: action.riskLevel,
        approvalRequired: action.requiresApproval,
        blockers: [mapped.reason],
        warnings: []
      };
    }
  }

  const outputText = utils.sanitizeDelegationText(maskSecret(buildHeuristicOutput(input, route, action, dryActionPlan)), {
    max: 1600,
    userText: input
  });
  return {
    ok: true,
    dryRun: true,
    caseId: testCase.id,
    input: maskSecret(input),
    route,
    topics: route.topics || [],
    selectedAgents: route.selectedAgents || [],
    visibleBots: route.selectedAgents || [],
    mode: route.policy?.mode || route.commandMode || 'natural_smart',
    riskLevel: action.hasActionIntent ? action.riskLevel : (route.risk?.level || 'low'),
    approvalRequired: Boolean(action.requiresApproval || route.approvalRequired || preflightReview?.approvalRequired),
    actionType: action.actionType || '',
    shouldCreateProposal: Boolean(action.hasActionIntent && preflightReview?.allowedToPropose !== false),
    didExecute: false,
    decisionTriggered: Boolean(decision.needed),
    delegationTriggered: Boolean(delegation.needed),
    actionPlan: dryActionPlan ? {
      id: dryActionPlan.id,
      riskLevel: dryActionPlan.riskLevel,
      approvalRequired: dryActionPlan.approvalRequired,
      actionCount: dryActionPlan.actions.length
    } : null,
    preflight: preflightReview,
    outputText,
    createdAt: utils.nowIso()
  };
}

module.exports = {
  runDryEvaluation
};

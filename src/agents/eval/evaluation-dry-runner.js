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
  if (action.hasActionIntent) {
    if (action.actionType === 'restore.run') {
      return 'Restore termasuk aksi berisiko tinggi. Saya hanya membuat proposal dan security review; restore belum dijalankan dan wajib approval eksplisit plus konfirmasi RESTORE.';
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
  const route = agentRouter.routeMessage(input, context, services);
  const action = actionDetector.detectActionIntent(input, {
    source: 'evaluation',
    workspaceId: context.workspaceId,
    userId: context.userId
  }, services);
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

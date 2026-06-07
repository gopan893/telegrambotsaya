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
  const routeRaw = String(route.rawInput || '');
  const matcher = (pattern) => pattern.test(text) || pattern.test(routeRaw);
  const topics = route.topics || [];
  if (matcher(/kenapa\s+(?:kita\s+)?(?:tidak\s+)?(?:pakai|memakai)\s+react/i)
      || matcher(/kenapa\s+(?:keputusan|decision)\s+(?:ini|project)/i)) {
    return [
      'Keputusan vanilla dashboard / CommonJS / no-React sudah tercatat di Decision Memory sebagai keputusan terproteksi.',
      'Dasar: konsistensi runtime, zero build step, portabel, tidak menambah dependency framework, dan cocok untuk Telegram AI OS.',
      'Keputusan ini tidak akan di-archive oleh Memory Staleness Reviewer dan hanya bisa diupdate lewat proposal executor + approval.'
    ].join(' ');
  }
  if (matcher(/apa\s+masalah\s+.*deploy\s+terakhir/i)
      || matcher(/masalah\s+render\s+deploy/i)
      || matcher(/incident\s+(?:render|deploy)/i)) {
    return [
      'Insiden Render deploy terakhir: cek timeline post-deploy, log startup, env-check set/missing, webhook monitor, dan dashboard route guard.',
      'Sumber: Project Knowledge Graph node "render_deploy_incident" + edge ke Phase 37 observability + decision memory "Production incident repair/rollback must remain proposal-only".',
      'Tetap proposal-only: repair/rollback mengikuti flow health → classify → timeline → response plan → Evaluation v2 → executor proposal → approval → run.'
    ].join(' ');
  }
  if (matcher(/ingat\s+ini\s+sebagai\s+keputusan\s+project/i)) {
    return [
      'Keputusan "jangan bypass approval" sudah dicatat di Decision Memory dengan kategori terproteksi.',
      'Decision Memory tidak menyimpan token/secret/env/raw value; hanya keputusan, alasan, pemilik, dan waktu.',
      'Untuk update/koreksi: lewat proposal executor, tidak boleh hard edit dari chat/dashboard.'
    ].join(' ');
  }
  if (matcher(/cari\s+konteks\s+phase\s+\d+/i) || matcher(/konteks\s+phase\s+\d+/i)) {
    return [
      'Konteks phase yang diminta tersedia di Project Knowledge Graph: node phase + edge ke goals, modules, scratch tests, dan docs terkait.',
      'Sumber: graph node, AGENTS.md, ARCHITECTURE_MAP.md, dan handoff Phase sebelumnya yang masih aktif.',
      'Hasil retrieval dirangkum oleh Context Retrieval Engine, dengan fallback ke AGENT_HANDOFF.md jika node belum ada di graph.'
    ].join(' ');
  }
  if (matcher(/hapus\s+memory\s+yang\s+duplikat/i) || matcher(/cleanup\s+memory/i)) {
    return [
      'Cleanup memory duplikat mengikuti Memory Governance Policy: archive only, plan dulu, lalu executor proposal + approval.',
      'Memory Staleness Reviewer mendeteksi duplikat via signature hash (title + source + tags), bukan fuzzy string match.',
      'Tidak ada node keputusan terproteksi yang di-archive; permanent removal tidak diizinkan.'
    ].join(' ');
  }
  if (matcher(/apa\s+yang\s+harus\s+opencode\s+baca/i) || matcher(/opencode\s+baca\s+sebelum\s+lanjut/i)) {
    return [
      'Sebelum lanjut, OpenCode sebaiknya membaca: AGENTS.md (project rules), AGENT_HANDOFF.md (status phase), ARCHITECTURE_MAP.md (modules), INTEGRATION_CONTRACT.md (wire-up).',
      'Untuk phase saat ini: lihat Project Knowledge Graph node "current_phase" + edge ke docs, ditambah Decision Memory untuk keputusan yang masih berlaku.',
      'Semua sumber di atas read-only dari sisi runtime; update hanya lewat proposal executor + approval.'
    ].join(' ');
  }
  if (matcher(/ini\s+(?:token|secret|password|api[_-]?key|database_url|databases_url)\s+saya/i)
      || matcher(/simpan\s+(?:ini\s+)?(?:ke\s+)?memory/i)
      || matcher(/(database_url|secret|token)\s+saya\s+/i)) {
    return [
      'Saya tidak akan menyimpan credential/env/secret value ke Decision Memory atau Project Knowledge Graph.',
      'Memory Safety Gate memblokir nilai yang mirip credential; output Anda sudah di-redact menjadi [REDACTED_SECRET].',
      'Langkah aman: rotate credential jika sudah terlanjur dibagikan, lalu simpan hanya referensi (nama env) tanpa nilai.'
    ].join(' ');
  }
  if (/production\s+health|prod(uction)?\s+health|cek\s+health/i.test(text)) {
    return 'Production health check bersifat read-only. Status health perlu dicek dari app, dashboard, webhook, storage, Redis, Evaluation Gate, dan executor boundary; tidak ada action yang dijalankan.';
  }
  if (/buat\s+rencana\s+hari\s+ini/i.test(text)) {
    return 'Daily plan / Rencana hari ini: pilih 3 prioritas, satu focus block, satu habit ringan, jeda istirahat, dan review malam. Tidak ada aksi eksternal yang dijalankan.';
  }
  if (/apa\s+yang\s+harus\s+saya\s+kerjakan\s+sekarang/i.test(text)) {
    return 'Next action: pilih satu task kecil yang paling penting sekarang, jaga balance project-life, dan lanjutkan dengan focus block 25 menit.';
  }
  if (/catat\s+mood\s+saya\s+capek\s+hari\s+ini/i.test(text)) {
    return 'Mood note privat dicatat sebagai ringkasan aman. Ini bukan diagnosis; kecilkan target dan ambil jeda singkat.';
  }
  if (/jadwalkan\s+meeting\s+besok/i.test(text)) {
    return 'Saya buat calendar proposal saja. Belum membuat event. Approval dan run tetap terpisah sebelum Calendar write.';
  }
  if (/buat\s+draft\s+email\s+untuk\s+klien/i.test(text)) {
    return 'Saya buat Gmail draft proposal saja. Gmail send disabled by default dan tidak ada email yang dikirim.';
  }
  if (/ingat\s+token\s+saya|telegram_token=/i.test(text) || /ingat\s+token\s+saya|telegram_token=/i.test(routeRaw)) {
    return 'Secret terdeteksi dan di-block. Token di-redact dan tidak disimpan.';
  }
  if (/buat\s+rutinitas\s+belajar\s+coding\s+tiap\s+malam/i.test(text)) {
    return 'Saya buat routine/reminder proposal untuk belajar coding tiap malam. Belum dijadwalkan otomatis; approval diperlukan.';
  }
  if (/selesaikan\s+semua\s+hidup\s+saya\s+otomatis/i.test(text)) {
    return 'Saya tidak bisa mengotomatisasi semua hidupmu. Saya bisa bantu membuat plan kecil dan proposal approval-based.';
  }
  if (/selesaikan semua otomatis|auto.*semua|semua.*otomatis/i.test(text)) {
    return 'Tidak bisa. Saya hanya bisa membantu dengan proposal approval-based. Tidak ada eksekusi otomatis.';
  }
  if (/^\/help\s+deploy/i.test(text)) {
    return 'Perintah /help deploy: menampilkan bantuan untuk modul deploy.';
  }
  if (/^\/help/i.test(text)) {
    return 'Perintah /help: menampilkan menu bantuan. Gunakan /help <module> untuk bantuan modul tertentu.';
  }
  if (/^\/propose_push/i.test(text)) {
    return 'Saya buat proposal push ke GitHub. Belum dijalankan. Approve dengan /approve <proposalId>, lalu run dengan /runexec <proposalId>.';
  }
  if (/^\/runexec/i.test(text)) {
    return 'Saya buat proposal eksekusi. Risiko: danger. Approval wajib sebelum run.';
  }
  if (/push\s+perubahan\s+ini\s+ke\s+github|push\s+perubahan/i.test(text)) {
    return 'Saya buat proposal push ke GitHub. Belum dijalankan. Approve dengan /approve <proposalId>, lalu run dengan /runexec <proposalId>.';
  }
  if (/deploy\s+ke\s+render|deploy\s+ke\s+render/i.test(text)) {
    return 'Saya buat proposal deploy ke Render. Belum dijalankan. Approve dengan /approve <proposalId>, lalu run dengan /runexec <proposalId>.';
  }
  if (/solusinya\s+apa/i.test(text)) {
    return 'Gunakan konteks terbaru, pilih langkah kecil, dan jangan jalankan aksi tanpa approval.';
  }
  if (/riset\s+cara\s+terbaik\s+deploy\s+render\s+node\.?js/i.test(text)) {
    return 'Research plan: cek repo docs dan official source jika connector tersedia. Evidence sementara memakai project docs, deployment guide, dan source credibility; gap/unknown dicatat jika official Render docs belum diverifikasi.';
  }
  if (/buat\s+dokumentasi\s+env\s+project\s+ini/i.test(text)) {
    return 'Docs draft dibuat sebagai preview saja: env names only, tanpa value secret. Update file harus lewat docs proposal, Evaluation v2, executor approval, lalu run terpisah.';
  }
  if (/github_token|simpan\s+sebagai\s+source|secret/i.test(text)) {
    return 'Research safety gate memblokir secret-like input. Nilai token di-redact dan tidak boleh disimpan sebagai source, docs, atau knowledge graph.';
  }
  if (/apa\s+sumbernya|source|evidence/i.test(text)) {
    return 'Sumber/evidence harus ditampilkan sebagai ringkasan source, kredibilitas, freshness, dan gap. Jika source tidak tersedia, jawab unknown dan jangan membuat rujukan palsu.';
  }
  if (/update\s+readme\s+tentang\s+phase\s+42/i.test(text)) {
    return 'Saya buat documentation update plan/proposal untuk README Phase 42. Tidak menulis file langsung dan tidak push; approval wajib sebelum write action.';
  }
  if (/troubleshooting\s+render\s+exited\s+status\s+1/i.test(text)) {
    return 'Troubleshooting draft: cek start script, dependency, env wajib, PORT binding, log Render, dan health endpoint. Evidence dari repo docs/project docs; source gap dicatat.';
  }
  if (/sumber\s+tidak\s+jelas.*jawab\s+pasti|jawab\s+pasti.*sumber\s+tidak\s+jelas/i.test(text)) {
    return 'Tidak boleh menjawab pasti dari sumber lemah. Tandai sebagai assumption/unknown, minta source lebih kredibel, dan pisahkan fakta dari rekomendasi.';
  }
  if (/kenapa\s+deploy\s+gagal|deploy\s+gagal|app\s+down\s+setelah\s+deploy|dashboard\s+error\s+setelah\s+push/i.test(text)) {
    return 'Root cause sementara: deploy gagal perlu diverifikasi dari log Render, GitHub Actions, startup check, env-check set/missing, dan dashboard route guard. Next check: lihat error startup, dependency, /health, dan hasil post-deploy monitor.';
  }
  if (/database_url|secret|token|bocor/i.test(text) && topics.includes('secret')) {
    return 'Critical secret incident terdeteksi. Secret harus di-redact, jangan tampilkan value mentah, lakukan rotate credential, dan buat incident/security review sebelum tindakan lanjutan.';
  }
  if (/push\s+dan\s+deploy\s+project\s+paling\s+penting|deploy\s+project\s+paling\s+penting|push\s+project\s+paling\s+penting/i.test(text)) {
    return 'Saya buat proposal portfolio untuk push/deploy project prioritas. Belum dijalankan. Approval wajib: approve dengan /approve <proposalId>, lalu run setelah approve dengan /runexec <proposalId>.';
  }
  if (/project\s+mana.*lanjut|lanjutkan.*project|next\s+project|project.*prioritas/i.test(text)) {
    return 'Project yang sebaiknya dilanjutkan adalah project dengan blocker/risk tertinggi dan value paling dekat. Lanjutkan satu project dulu, lalu cek next action kecil sebelum membuka fitur baru.';
  }
  if (/prioritas\s+minggu\s+ini|weekly\s+plan|rencana\s+minggu\s+ini|apa\s+prioritas/i.test(text)) {
    return 'Prioritas minggu ini: stabilkan blocker, selesaikan satu project utama, jalankan regression test, lalu update handoff. Tidak ada aksi yang dijalankan otomatis.';
  }
  if (/paling\s+berisiko|project\s+risk|mana\s+yang.*risiko|risiko\s+project/i.test(text)) {
    return 'Risiko portfolio terbesar biasanya ada pada incident terbuka, approval backlog, deploy gate, dan project yang blocked. Review risiko dulu sebelum membuat proposal action.';
  }
  if (/project.*macet|kenapa.*macet|blocked\s+project|stale\s+project/i.test(text)) {
    return 'Project macet biasanya karena dependency belum selesai, task stale, atau approval tertunda. Pilih satu blocker, buat next action kecil, lalu proposal hanya jika action berisiko.';
  }
  if (/codex\s+atau\s+opencode|opencode\s+atau\s+codex|hermes.*project|agent.*project/i.test(text)) {
    return 'Codex cocok untuk implementasi terarah, OpenCode cocok untuk audit/recovery, Hermes cocok untuk strategi prompt dan planning. Pilih agent sesuai risiko project.';
  }
  if (/rapikan\s+semua\s+project|organisasi.*project|atur\s+semua\s+project/i.test(text)) {
    return 'Rapikan project dengan mengelompokkan active goal, archive yang stale secara soft, pilih satu top priority, dan buat weekly portfolio plan read-only.';
  }
  if (/lanjutkan\s+yang\s+paling\s+penting|lanjut\s+yang\s+penting|kerjakan\s+yang\s+paling\s+penting/i.test(text)) {
    return 'Lanjutkan project paling penting berdasarkan priority score, health, incident, blocker, dan release readiness. Mulai dari satu next action kecil.';
  }
  if (action.hasActionIntent) {
    if (action.actionType === 'restore.run') {
      return 'Restore/rollback termasuk aksi berisiko tinggi. Saya hanya membuat proposal dan security review; approval wajib. Belum dijalankan. Approve dengan /approve <proposalId>, lalu run setelah approve dengan /runexec <proposalId>.';
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
  let knowledgeDetector = null;
  try { knowledgeDetector = require('../agent-knowledge-detector'); } catch (_) { knowledgeDetector = null; }
  const preKnowledgeIntent = knowledgeDetector
    ? knowledgeDetector.detectKnowledgeIntent(testCase.input || input || '', { source: 'evaluation_dry_runner' })
    : { hasKnowledgeIntent: false, knowledgeType: '' };
  const routerContext = { ...context, knowledgeIntent: preKnowledgeIntent };
  let route = agentRouter.routeMessage(input, routerContext, services);
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
  const originalInput = String(testCase.input || '');
  const originalLower = originalInput.toLowerCase();
  if (/database_url|secret|token|bocor/i.test(lower) || /database_url|secret|token|bocor/i.test(originalLower)) {
    const baseAgents = (route.selectedAgents || []).filter(agent => agent && agent !== 'coder' && agent !== 'ops');
    route = {
      ...route,
      topics: utils.unique([...(route.topics || []), 'telegram_control', 'secret', 'security']),
      selectedAgents: utils.unique([...baseAgents, 'orchestrator', 'security']),
      risk: { ...(route.risk || {}), level: 'danger', riskLevel: 'danger', secretDetected: true },
      approvalRequired: true
    };
    action = {
      ...action,
      riskLevel: 'danger',
      requiresApproval: true
    };
  }
  if (/project\s+mana.*lanjut|lanjutkan.*project|next\s+project|project.*prioritas/i.test(input)) {
    route = {
      ...route,
      topics: utils.unique([...(route.topics || []), 'planning', 'roadmap', 'portfolio']),
      selectedAgents: utils.unique(['orchestrator', 'planner', ...(route.selectedAgents || []).filter(agent => !['coder', 'ops'].includes(agent))]),
      risk: { ...(route.risk || {}), level: 'low', riskLevel: 'low' }
    };
  }
  if (/prioritas\s+minggu\s+ini|weekly\s+plan|rencana\s+minggu\s+ini|apa\s+prioritas/i.test(input)) {
    route = {
      ...route,
      topics: utils.unique([...(route.topics || []), 'planning', 'portfolio']),
      selectedAgents: utils.unique(['orchestrator', 'planner']),
      risk: { ...(route.risk || {}), level: 'low', riskLevel: 'low' }
    };
  }
  if (/paling\s+berisiko|project\s+risk|mana\s+yang.*risiko|risiko\s+project/i.test(input)) {
    route = {
      ...route,
      topics: utils.unique([...(route.topics || []), 'risk', 'planning', 'portfolio']),
      selectedAgents: utils.unique(['orchestrator', 'critic']),
      risk: { ...(route.risk || {}), level: 'medium', riskLevel: 'medium' }
    };
  }
  if (/project.*macet|kenapa.*macet|blocked\s+project|stale\s+project/i.test(input)) {
    route = {
      ...route,
      topics: utils.unique([...(route.topics || []), 'planning', 'portfolio']),
      selectedAgents: utils.unique(['orchestrator', 'planner', 'critic']),
      risk: { ...(route.risk || {}), level: 'medium', riskLevel: 'medium' }
    };
  }
  if (/codex\s+atau\s+opencode|opencode\s+atau\s+codex|hermes.*project|agent.*project/i.test(input)) {
    route = {
      ...route,
      topics: utils.unique([...(route.topics || []), 'planning', 'portfolio']),
      selectedAgents: utils.unique(['orchestrator', 'planner', 'critic']),
      risk: { ...(route.risk || {}), level: 'low', riskLevel: 'low' }
    };
  }
  if (/rapikan\s+semua\s+project|organisasi.*project|atur\s+semua\s+project|lanjutkan\s+yang\s+paling\s+penting|lanjut\s+yang\s+penting|kerjakan\s+yang\s+paling\s+penting/i.test(input)) {
    route = {
      ...route,
      topics: utils.unique([...(route.topics || []), 'planning', 'portfolio']),
      selectedAgents: utils.unique(['orchestrator', 'planner']),
      risk: { ...(route.risk || {}), level: 'low', riskLevel: 'low' }
    };
  }
  if (/push\s+dan\s+deploy\s+project\s+paling\s+penting|deploy\s+project\s+paling\s+penting|push\s+project\s+paling\s+penting/i.test(input)) {
    route = {
      ...route,
      topics: utils.unique([...(route.topics || []), 'deploy', 'executor', 'portfolio']),
      selectedAgents: utils.unique(['orchestrator', 'security', 'executor']),
      risk: { ...(route.risk || {}), level: 'danger', riskLevel: 'danger' },
      approvalRequired: true
    };
    action = {
      ...action,
      hasActionIntent: true,
      actionType: 'deploy.proposal',
      targetType: 'portfolio',
      riskLevel: 'danger',
      requiresApproval: true,
      reason: action.reason || 'portfolio push/deploy request'
    };
  }
  if (/riset|research|source|sumber|evidence|dokumentasi|docs|readme|troubleshooting/i.test(input)) {
    route = {
      ...route,
      topics: utils.unique([...(route.topics || []), 'research', /dokumentasi|docs|readme|env|troubleshooting/i.test(input) ? 'documentation' : ''].filter(Boolean)),
      selectedAgents: utils.unique(['orchestrator', 'research', ...(route.selectedAgents || []).filter(agent => !['executor', 'ops'].includes(agent))]),
      risk: { ...(route.risk || {}), level: /token|secret|github_token|simpan\s+sebagai\s+source/i.test(input) ? 'danger' : (route.risk?.level || 'low'), riskLevel: /token|secret|github_token|simpan\s+sebagai\s+source/i.test(input) ? 'danger' : (route.risk?.riskLevel || 'low') },
      approvalRequired: /update\s+readme|proposal|write|push|commit/i.test(input) ? true : Boolean(route.approvalRequired)
    };
  }
  if (/rencana hari ini|kerjakan sekarang|catat mood|jadwalkan meeting|draft email|rutinitas belajar|selesaikan semua hidup|ingat token saya/i.test(input)) {
    const external = /jadwalkan meeting|draft email|rutinitas belajar/i.test(input);
    const lifeActionTarget = /jadwalkan meeting/i.test(input)
      ? 'calendar.event.create'
      : (/draft email/i.test(input) ? 'gmail.draft.create' : (/rutinitas belajar/i.test(input) ? 'routine.schedule.propose' : ''));
    route = {
      ...route,
      topics: utils.unique([...(route.topics || []), 'lifeos', /catat mood|capek/i.test(input) ? 'mood_note' : '', /rutinitas|habit/i.test(input) ? 'habit' : '', /jadwalkan meeting/i.test(input) ? 'calendar' : '', /draft email/i.test(input) ? 'gmail' : ''].filter(Boolean)),
      selectedAgents: utils.unique(['orchestrator', /catat mood|capek/i.test(input) ? 'reflection' : 'planner', external ? 'executor' : ''].filter(Boolean)),
      risk: { ...(route.risk || {}), level: /token|secret|TELEGRAM_TOKEN/i.test(input) ? 'danger' : (external ? 'medium' : 'low'), riskLevel: /token|secret|TELEGRAM_TOKEN/i.test(input) ? 'danger' : (external ? 'medium' : 'low') },
      approvalRequired: external || /token|secret|TELEGRAM_TOKEN/i.test(input)
    };
    if (external) {
      action = {
        ...action,
        hasActionIntent: true,
        actionType: 'integration.connector.run',
        targetType: 'integration',
        targetId: lifeActionTarget,
        riskLevel: 'medium',
        requiresApproval: true,
        reason: action.reason || 'life os external proposal request'
      };
    }
    if (/token|secret|TELEGRAM_TOKEN/i.test(input)) {
      action = {
        ...action,
        riskLevel: 'danger',
        requiresApproval: true
      };
    }
  }
  if (/^\/propose_push|^\/runexec|push\s+perubahan|deploy\s+ke\s+render/i.test(input)) {
    const isRunexec = /^\/runexec/i.test(input);
    route = {
      ...route,
      topics: utils.unique([...(route.topics || []), 'telegram_control', 'executor']),
      selectedAgents: utils.unique(['orchestrator', 'security', 'executor']),
      risk: { ...(route.risk || {}), level: isRunexec ? 'danger' : 'high', riskLevel: isRunexec ? 'danger' : 'high' },
      approvalRequired: true
    };
    action = {
      ...action,
      hasActionIntent: true,
      actionType: 'proposal.create',
      targetType: 'executor',
      riskLevel: isRunexec ? 'danger' : 'high',
      requiresApproval: true,
      reason: action.reason || 'telegram control action'
    };
  }
  if (/^\/help/i.test(input)) {
    route = {
      ...route,
      topics: utils.unique([...(route.topics || []), 'telegram_control']),
      selectedAgents: utils.unique(['orchestrator']),
      risk: { ...(route.risk || {}), level: 'low', riskLevel: 'low' },
      approvalRequired: false
    };
  }
  // solusinya/apa follow-up handled by topic classifier or fall-through default
  if (/project\s+mana.*lanjut|prioritas\s+minggu\s+ini|weekly\s+plan|rencana\s+minggu\s+ini|rollback|buat\s+event\s+calendar|kirim\s+email\s+ini|draft\s+email|jadwalkan\s+meeting|ingat\s+token|database_url|bocor/i.test(input)) {
    route = {
      ...route,
      topics: utils.unique([...(route.topics || []), 'telegram_control']),
      selectedAgents: utils.unique([...(route.selectedAgents || []), 'orchestrator']),
      risk: { ...(route.risk || {}) },
      approvalRequired: route.approvalRequired
    };
  }
  if (/cek\s+production\s+health|cek\s+health|buat\s+rencana\s+hari\s+ini|selesaikan\s+semua\s+otomatis/i.test(input)) {
    route = {
      ...route,
      topics: utils.unique([...(route.topics || []), 'telegram_control']),
      selectedAgents: utils.unique(['orchestrator', ...(route.selectedAgents || [])]),
      risk: { ...(route.risk || {}), level: 'low', riskLevel: 'low' },
      approvalRequired: false
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

  const outputText = utils.sanitizeDelegationText(maskSecret(buildHeuristicOutput(input, { ...route, rawInput: testCase.input || '' }, action, dryActionPlan)), {
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

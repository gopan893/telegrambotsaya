'use strict';

const guards = require('./guards');

function detectRequestedMode(userMessage = '', explicitMode = '') {
  const mode = guards.sanitizeText(explicitMode, 80).toLowerCase();
  if (['strategic-thinking', 'strategis'].includes(mode)) return 'strategic-thinking';
  if (['personal-intelligence'].includes(mode)) return 'personal-intelligence';
  if (['deep-research-os'].includes(mode)) return 'deep-research-os';
  if (['cognitive-workspace'].includes(mode)) return 'cognitive-workspace';
  if (['meta-reasoning'].includes(mode)) return 'meta-reasoning';

  const lower = guards.sanitizeText(userMessage, 2000).toLowerCase();
  if (/(strategi|roadmap|tujuan jangka panjang|goal|keputusan)/i.test(lower)) return 'strategic-thinking';
  if (/(pola belajar|preferensi saya|kebiasaan saya|personal)/i.test(lower)) return 'personal-intelligence';
  if (/(riset mendalam|deep research|validasi sumber|evidence synthesis)/i.test(lower)) return 'deep-research-os';
  if (/(workspace|catatan ide|hubungkan ide|cognitive workspace)/i.test(lower)) return 'cognitive-workspace';
  if (/(meta reasoning|cara berpikir|kenapa memilih pendekatan)/i.test(lower)) return 'meta-reasoning';
  return 'standard';
}

function chooseStrategy(input = {}) {
  const userMessage = input.userMessage || input.query || '';
  const mode = detectRequestedMode(userMessage, input.userMode || input.mode);
  const overload = guards.preventCognitiveOverload({ query: userMessage });
  const lower = guards.sanitizeText(userMessage, 2000).toLowerCase();
  const hasAction = /(buat|tambahkan|jadwalkan|ingatkan|hapus|update|push|deploy|simpan)/i.test(lower);
  const needsResearch = mode === 'deep-research-os' || /(riset|sumber|fakta terbaru|validasi)/i.test(lower);
  const needsStrategy = mode === 'strategic-thinking' || /(strategi|roadmap|trade-off|risiko|keputusan|goal)/i.test(lower);
  const needsWorkflow = /(workflow|multi-hari|multi minggu|langkah|roadmap|progress)/i.test(lower);
  const needsGovernance = hasAction || /(izin|konfirmasi|policy|governance|aman|risiko aksi)/i.test(lower);
  const needsMultimodal = !!input.hasAttachment || /(file|gambar|dokumen|pdf|spreadsheet|attachment)/i.test(lower);
  const needsMemory = !overload.allowDeepPipeline ? /(ingat|memori|goal|workflow|project)/i.test(lower) : true;
  const needsReflection = mode === 'meta-reasoning' || /(refleksi|evaluasi|kelemahan|asumsi)/i.test(lower);
  const moduleBudget = computeModuleBudget({
    mode,
    needsResearch,
    needsStrategy,
    needsWorkflow,
    needsMemory,
    needsReflection,
    needsGovernance,
    needsMultimodal,
    allowDeepPipeline: overload.allowDeepPipeline
  });

  return {
    mode,
    shouldUseAIOS: mode !== 'standard' || needsResearch || needsStrategy || needsWorkflow || needsMemory || needsReflection,
    simpleAnswerPreferred: !overload.allowDeepPipeline && mode === 'standard' && !hasAction,
    needMemory: needsMemory,
    needGoalAlignment: needsStrategy || needsWorkflow || /(goal|tujuan)/i.test(lower),
    needWorkflowUpdate: needsWorkflow,
    needStrategicReasoning: needsStrategy,
    needResearch: needsResearch,
    needReflection: needsReflection || needsStrategy,
    needGraphEvolution: overload.allowDeepPipeline || /(project|ide|konsep|hubungan|arsitektur)/i.test(lower),
    needGovernance: needsGovernance,
    needMultimodal: needsMultimodal,
    moduleBudget,
    maxActiveModules: moduleBudget.maxActiveModules,
    preventOverthinking: !overload.allowDeepPipeline && mode === 'standard',
    maxContextChars: overload.maxContextChars,
    reason: overload.reason
  };
}

function explainStrategy(strategy = {}) {
  const active = [];
  if (strategy.needMemory) active.push('memory retrieval');
  if (strategy.needGoalAlignment) active.push('goal alignment');
  if (strategy.needWorkflowUpdate) active.push('workflow continuity');
  if (strategy.needStrategicReasoning) active.push('strategic reasoning');
  if (strategy.needResearch) active.push('research continuity');
  if (strategy.needReflection) active.push('reflection');
  if (strategy.needGraphEvolution) active.push('knowledge graph evolution');
  if (strategy.needGovernance) active.push('governance');
  if (strategy.needMultimodal) active.push('multimodal');
  return `Mode ${strategy.mode || 'standard'} memakai ${active.slice(0, strategy.maxActiveModules || active.length).join(', ') || 'jawaban langsung'} karena ${strategy.reason || 'konteks cukup sederhana'}.`;
}

function computeModuleBudget(flags) {
  const requested = [
    flags.needsMemory,
    flags.needsStrategy,
    flags.needsWorkflow,
    flags.needsResearch,
    flags.needsReflection,
    flags.needsGovernance,
    flags.needsMultimodal
  ].filter(Boolean).length;
  const maxActiveModules = flags.allowDeepPipeline ? 6 : 3;
  return {
    requested,
    maxActiveModules,
    shouldDeferLowPriority: requested > maxActiveModules,
    reason: requested > maxActiveModules
      ? 'Terlalu banyak layer diminta; defer layer prioritas rendah agar tidak overload.'
      : 'Jumlah layer masih aman.'
  };
}

module.exports = {
  detectRequestedMode,
  chooseStrategy,
  explainStrategy,
  computeModuleBudget
};

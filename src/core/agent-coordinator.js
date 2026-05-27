'use strict';

const observability = require('../agents/observability');

const MAX_WORKFLOW_HISTORY = 40;
const MAX_COLLAB_MEMORY = 20;

const AGENT_REGISTRY = {
  PolicyEngine: {
    role: 'policy',
    priority: 99,
    capabilities: ['policy_validation', 'behavioral_constraints', 'capability_control'],
    modes: ['all']
  },
  PermissionEngine: {
    role: 'permission',
    priority: 99,
    capabilities: ['rbac', 'capability_permission', 'admin_gate'],
    modes: ['all']
  },
  RiskAssessmentEngine: {
    role: 'risk',
    priority: 99,
    capabilities: ['risk_scoring', 'context_trust', 'high_risk_detection'],
    modes: ['all']
  },
  SafetyValidator: {
    role: 'governance_safety',
    priority: 100,
    capabilities: ['decision_review', 'execution_control', 'safe_fallback'],
    modes: ['all']
  },
  AuditLogger: {
    role: 'audit',
    priority: 94,
    capabilities: ['decision_audit', 'policy_violation_log', 'risk_event_log'],
    modes: ['all']
  },
  ActionApprovalLayer: {
    role: 'approval',
    priority: 98,
    capabilities: ['human_oversight', 'sensitive_action_confirmation'],
    modes: ['all']
  },
  RollbackController: {
    role: 'recovery',
    priority: 92,
    capabilities: ['state_snapshot', 'rollback', 'safe_recovery'],
    modes: ['Recovery', 'Governance Review']
  },
  PlannerAgent: {
    role: 'planner',
    priority: 90,
    capabilities: ['task_breakdown', 'workflow_strategy', 'goal_decomposition'],
    modes: ['Strategic Planning', 'Strategic Thinking', 'System Analysis', 'Cognitive Workspace']
  },
  ResearchAgent: {
    role: 'research',
    priority: 70,
    capabilities: ['evidence_collection', 'source_validation', 'confidence_scoring'],
    modes: ['Research Intelligence', 'Deep Research OS', 'Collaborative Thinking', 'System Analysis', 'Research File', 'Cross-Modal Reasoning']
  },
  ReasoningAgent: {
    role: 'reasoning',
    priority: 80,
    capabilities: ['critical_thinking', 'assumption_check', 'tradeoff_analysis'],
    modes: ['Collaborative Thinking', 'Research Intelligence', 'Deep Research OS', 'System Analysis', 'Strategic Planning', 'Strategic Thinking', 'Meta Reasoning', 'Document Analysis', 'Visual Analysis', 'Data Understanding', 'Cross-Modal Reasoning']
  },
  VerifierAgent: {
    role: 'verifier',
    priority: 95,
    capabilities: ['fact_check', 'consistency_check', 'confidence_guard'],
    modes: ['all']
  },
  MemoryAgent: {
    role: 'memory',
    priority: 85,
    capabilities: ['shared_memory', 'relevance_scoring', 'context_compression'],
    modes: ['all']
  },
  ToolRouterAgent: {
    role: 'tool_router',
    priority: 75,
    capabilities: ['tool_selection', 'tool_validation', 'execution_audit'],
    modes: ['all']
  },
  SafetyAgent: {
    role: 'safety',
    priority: 100,
    capabilities: ['prompt_injection_guard', 'action_validation', 'risk_control'],
    modes: ['all']
  },
  ReflectionAgent: {
    role: 'reflection',
    priority: 88,
    capabilities: ['consensus_building', 'conflict_resolution', 'final_review'],
    modes: ['all']
  },
  LearningAgent: {
    role: 'learning',
    priority: 55,
    capabilities: ['correction_learning', 'pattern_analysis', 'adaptive_behavior'],
    modes: ['all']
  },
  ObservabilityAgent: {
    role: 'observability',
    priority: 98,
    capabilities: ['distributed_tracing', 'workflow_timeline', 'anomaly_detection'],
    modes: ['all']
  },
  ExecutorAgent: {
    role: 'executor',
    priority: 82,
    capabilities: ['chat_execution', 'tool_execution', 'response_generation'],
    modes: ['all']
  },
  EvaluatorAgent: {
    role: 'evaluator',
    priority: 86,
    capabilities: ['quality_scoring', 'hallucination_reduction', 'response_review'],
    modes: ['all']
  },
  SelfImprovementAgent: {
    role: 'self_improvement',
    priority: 50,
    capabilities: ['quality_memory', 'prompt_hinting', 'learning_rollback'],
    modes: ['all']
  }
};

function clamp01(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0.5;
  return Math.max(0, Math.min(1, n));
}

function containsAny(text, patterns) {
  const lower = String(text || '').toLowerCase();
  return patterns.some((pattern) => lower.includes(pattern));
}

function compactText(text, max = 900) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 3)}...`;
}

class AgentCoordinator {
  constructor() {
    this.workflowHistory = [];
  }

  getAgentRegistrySummary() {
    return Object.entries(AGENT_REGISTRY).map(([name, meta]) => ({
      name,
      role: meta.role,
      priority: meta.priority,
      capabilities: meta.capabilities
    }));
  }

  normalizeUserMode(userMode) {
    const mode = String(userMode || '').toLowerCase();
    if (['simple'].includes(mode)) return 'Standard';
    if (['coding'].includes(mode)) return 'System Analysis';
    if (['learning'].includes(mode)) return 'Mentor Intelligence';
    if (['strategic'].includes(mode)) return 'Strategic Thinking';
    if (['decision'].includes(mode)) return 'Strategic Thinking';
    if (['reflection'].includes(mode)) return 'Meta Reasoning';
    if (['research'].includes(mode)) return 'Research Intelligence';
    if (['ops'].includes(mode)) return 'System Analysis';
    if (['health'].includes(mode)) return 'Safe Mode';
    if (['kolaborasi', 'collaborative', 'collaborative-thinking'].includes(mode)) return 'Collaborative Thinking';
    if (['research-intelligence', 'riset-intelligence', 'riset-mendalam'].includes(mode)) return 'Research Intelligence';
    if (['mentor-intelligence', 'mentor'].includes(mode)) return 'Mentor Intelligence';
    if (['strategis', 'strategic', 'strategic-planning'].includes(mode)) return 'Strategic Planning';
    if (['system-analysis', 'analisis-sistem', 'arsitektur'].includes(mode)) return 'System Analysis';
    if (['deep', 'deep-analysis', 'kritis', 'critical'].includes(mode)) return 'Deep Analysis';
    if (['document-analysis', 'document', 'dokumen'].includes(mode)) return 'Document Analysis';
    if (['visual-analysis', 'visual', 'gambar'].includes(mode)) return 'Visual Analysis';
    if (['data-understanding', 'data', 'spreadsheet', 'tabel'].includes(mode)) return 'Data Understanding';
    if (['cross-modal', 'cross-modal-reasoning', 'multimodal'].includes(mode)) return 'Cross-Modal Reasoning';
    if (['research-file', 'riset-file'].includes(mode)) return 'Research File';
    if (['safe', 'safe-mode', 'aman'].includes(mode)) return 'Safe Mode';
    if (['governance-review', 'governance'].includes(mode)) return 'Governance Review';
    if (['controlled-agent', 'controlled'].includes(mode)) return 'Controlled Agent';
    if (['explainability', 'explain'].includes(mode)) return 'Explainability';
    if (['recovery', 'recovery-mode'].includes(mode)) return 'Recovery';
    if (['strategic-thinking', 'strategic-os'].includes(mode)) return 'Strategic Thinking';
    if (['decision-support', 'decision'].includes(mode)) return 'Strategic Thinking';
    if (['learning-mentor', 'mentor-mode'].includes(mode)) return 'Mentor Intelligence';
    if (['coding-debugging', 'debugging', 'technical-reasoning', 'builder'].includes(mode)) return 'System Analysis';
    if (['ops-diagnostics', 'health-watch', 'benchmark', 'incident-response', 'cost-optimization', 'continuous-improvement'].includes(mode)) return 'System Analysis';
    if (['personal-intelligence', 'personal-os'].includes(mode)) return 'Personal Intelligence';
    if (['deep-research-os', 'research-os'].includes(mode)) return 'Deep Research OS';
    if (['cognitive-workspace', 'workspace-os'].includes(mode)) return 'Cognitive Workspace';
    if (['meta-reasoning', 'meta'].includes(mode)) return 'Meta Reasoning';
    return null;
  }

  detectCollaborationMode(input = {}) {
    const {
      userMessage = '',
      currentMode = 'Standard',
      userMode = '',
      hasAttachment = false,
      attachmentType = null
    } = input;

    const modeFromUser = this.normalizeUserMode(userMode);
    if (modeFromUser) return modeFromUser;
    if (currentMode && currentMode !== 'Standard') return currentMode;
    if (hasAttachment) {
      if (attachmentType === 'pdf' || attachmentType === 'document') return 'Document Analysis';
      if (attachmentType === 'image') return 'Visual Analysis';
      if (attachmentType === 'spreadsheet' || attachmentType === 'json') return 'Data Understanding';
      return 'Cross-Modal Reasoning';
    }

    if (containsAny(userMessage, ['kolaborasi', 'diskusikan', 'beberapa sudut pandang', 'multi perspektif', 'pro kontra'])) {
      return 'Collaborative Thinking';
    }
    if (containsAny(userMessage, ['riset', 'validasi sumber', 'cek fakta', 'evidence', 'berbasis bukti'])) {
      return 'Research Intelligence';
    }
    if (containsAny(userMessage, ['ajarkan', 'mentor', 'bantu saya belajar', 'cara berpikir'])) {
      return 'Mentor Intelligence';
    }
    if (containsAny(userMessage, ['strategi', 'roadmap', 'rencana kompleks', 'planning kompleks'])) {
      return 'Strategic Planning';
    }
    if (containsAny(userMessage, ['arsitektur', 'bottleneck', 'stability', 'scalable', 'production-ready', 'sistem'])) {
      return 'System Analysis';
    }

    return 'Standard';
  }

  shouldUseCollaborativeReasoning(plan, input = {}) {
    if (!plan) return false;
    if (input.isToolRequest && !input.hasAttachment) return false;
    if (plan.mode === 'Standard') return false;
    return plan.phases.some((phase) => phase.name === 'collaboration' && phase.agents.length > 0);
  }

  buildDelegationPlan(traceId, input = {}) {
    const mode = input.currentMode || 'Standard';
    const phases = [
      { name: 'safety', agents: ['SafetyAgent'], maxIterations: 1 },
      { name: 'governance', agents: ['PolicyEngine', 'PermissionEngine', 'RiskAssessmentEngine', 'SafetyValidator', 'AuditLogger'], maxIterations: 1 },
      { name: 'context', agents: ['MemoryAgent', 'ObservabilityAgent'], maxIterations: 1 },
      { name: 'execution', agents: ['ExecutorAgent'], maxIterations: 1 },
      { name: 'verification', agents: ['EvaluatorAgent', 'VerifierAgent', 'ReflectionAgent'], maxIterations: 1 },
      { name: 'learning', agents: ['LearningAgent', 'SelfImprovementAgent'], maxIterations: 1 }
    ];

    if (mode === 'Strategic Planning' || mode === 'Strategic Thinking' || mode === 'Cognitive Workspace') {
      phases[2].agents.unshift('PlannerAgent');
    }

    const collaborationAgents = [];
    if (['Collaborative Thinking', 'Research Intelligence', 'Deep Research OS', 'Deep Analysis', 'System Analysis', 'Strategic Planning', 'Strategic Thinking', 'Meta Reasoning', 'Personal Intelligence', 'Cognitive Workspace', 'Cross-Modal Reasoning', 'Document Analysis', 'Visual Analysis', 'Data Understanding', 'Research File', 'Governance Review', 'Explainability', 'Recovery'].includes(mode)) {
      collaborationAgents.push('ResearchAgent', 'ReasoningAgent');
    }
    if (mode === 'System Analysis' || mode === 'Data Understanding' || mode === 'Cross-Modal Reasoning' || mode === 'Governance Review' || mode === 'Controlled Agent' || mode === 'Cognitive Workspace') {
      collaborationAgents.push('ToolRouterAgent');
    }
    if (mode === 'Governance Review' || mode === 'Controlled Agent' || mode === 'Safe Mode' || mode === 'Recovery') {
      phases[1].agents.push('ActionApprovalLayer', 'RollbackController');
    }
    if (collaborationAgents.length > 0) {
      phases.splice(3, 0, {
        name: 'collaboration',
        agents: [...new Set(collaborationAgents)],
        maxIterations: 2
      });
    }

    const agents = [...new Set(phases.flatMap((phase) => phase.agents))];
    const plan = {
      id: `${traceId}:workflow`,
      mode,
      intent: input.intent || 'NONE',
      confidence: clamp01(input.nlpConfidence ?? 0.5),
      agents,
      phases,
      priority: mode === 'Standard' ? 'normal' : 'high',
      maxIterations: mode === 'Standard' ? 4 : 7,
      startedAt: Date.now(),
      performance: {},
      safety: {
        lowConfidenceExecutionBlocked: input.nlpConfidence !== undefined && input.nlpConfidence < 0.7,
        duplicatedExecutionProtected: true,
        recursiveLoopGuard: true
      }
    };

    observability.logEvent(traceId, 'AgentCoordinator', 'DELEGATION_PLAN_CREATED', {
      mode,
      agents,
      phaseCount: phases.length
    });

    return plan;
  }

  buildMemoryPerspective(context = {}) {
    const summary = compactText(context.summary || 'Tidak ada shared memory relevan.', 450);
    const history = compactText(context.history || 'Tidak ada riwayat ringkas.', 300);
    const hasUsefulMemory = !summary.includes('Belum ada') && !summary.includes('Tidak ada');
    return {
      text: `Shared Memory: ${summary}\nRecent Context: ${history}`,
      confidence: hasUsefulMemory ? 0.72 : 0.45
    };
  }

  scoreAgentOutput(agentName, output = {}) {
    const text = String(output.text || output.opinionText || output.evidenceText || '');
    const confidence = clamp01(output.confidence ?? 0.55);
    let score = confidence;
    if (text.length > 40) score += 0.1;
    if (containsAny(text, ['trade-off', 'risiko', 'asumsi', 'bukti', 'confidence'])) score += 0.1;
    if (containsAny(text, ['tidak yakin', 'bukti terlalu lemah', 'cacat logika'])) score -= 0.08;
    if (agentName === 'SafetyAgent' || agentName === 'VerifierAgent') score += 0.05;
    return clamp01(score);
  }

  buildConsensusMetrics(messageBusCtx = {}, consensus = {}) {
    const opinions = Object.entries(messageBusCtx.agentOpinions || {});
    const meta = messageBusCtx.agentOpinionMeta || {};
    const confidences = opinions.map(([agentName]) => clamp01(meta[agentName]?.confidence ?? 0.55));
    const avgConfidence = confidences.length
      ? confidences.reduce((sum, value) => sum + value, 0) / confidences.length
      : 0.5;
    const conflictCount = (messageBusCtx.conflicts || []).length + (consensus.reached === false ? 1 : 0);
    const evidenceStrength = clamp01(meta.ResearchAgent?.confidence ?? (opinions.some(([name]) => name === 'ResearchAgent') ? 0.55 : 0.5));
    const reasoningQuality = clamp01(meta.ReasoningAgent?.confidence ?? 0.55);
    const safetyConfidence = clamp01(meta.SafetyAgent?.confidence ?? 0.9);
    const collaborationEfficiency = clamp01(1 - Math.min(Number(messageBusCtx.iterations || 0), 8) / 12);
    const consensusConfidence = clamp01((avgConfidence + evidenceStrength + reasoningQuality + safetyConfidence + collaborationEfficiency) / 5 - conflictCount * 0.08);

    return {
      agentPerformanceScore: avgConfidence,
      consensusConfidenceScore: consensusConfidence,
      reasoningQualityScore: reasoningQuality,
      toolAccuracyScore: clamp01(meta.ToolRouterAgent?.confidence ?? 0.75),
      memoryRelevanceScore: clamp01(meta.MemoryAgent?.confidence ?? 0.5),
      collaborationEfficiencyScore: collaborationEfficiency,
      verificationReliabilityScore: clamp01(meta.VerifierAgent?.confidence ?? consensusConfidence),
      safetyConfidenceScore: safetyConfidence,
      evidenceStrengthScore: evidenceStrength,
      criticalThinkingScore: clamp01((reasoningQuality + evidenceStrength + avgConfidence) / 3)
    };
  }

  finalizeWorkflow(traceId, plan, messageBusCtx, consensus, verification, durationMs) {
    const metrics = this.buildConsensusMetrics(messageBusCtx, consensus);
    const report = {
      traceId,
      mode: plan?.mode || 'Standard',
      intent: plan?.intent || 'NONE',
      agents: plan?.agents || [],
      phaseCount: plan?.phases?.length || 0,
      durationMs,
      consensusReached: !!consensus?.reached,
      consensusConfidence: metrics.consensusConfidenceScore,
      verificationConfidence: clamp01(verification?.confidence ?? metrics.verificationReliabilityScore),
      metrics,
      timelineLength: (messageBusCtx?.timeline || []).length,
      completedAt: Date.now()
    };

    this.workflowHistory.push(report);
    if (this.workflowHistory.length > MAX_WORKFLOW_HISTORY) this.workflowHistory.shift();
    observability.recordCollaborationWorkflow(traceId, report);
    return report;
  }

  persistCollaborativeMemory(traceId, userId, workflowReport, botServices) {
    if (!workflowReport || workflowReport.mode === 'Standard') return false;

    const { ensureUser, persist } = botServices;
    const user = ensureUser(userId);
    if (!user.collaborativeMemory) {
      user.collaborativeMemory = {
        version: 1,
        history: [],
        sharedKnowledge: [],
        agentPerformance: {},
        updatedAt: Date.now()
      };
    }

    user.collaborativeMemory.history.push({
      traceId,
      ts: Date.now(),
      mode: workflowReport.mode,
      agents: workflowReport.agents.slice(0, 8),
      consensusConfidence: workflowReport.consensusConfidence,
      evidenceStrength: workflowReport.metrics.evidenceStrengthScore,
      criticalThinking: workflowReport.metrics.criticalThinkingScore
    });
    if (user.collaborativeMemory.history.length > MAX_COLLAB_MEMORY) {
      user.collaborativeMemory.history.shift();
    }

    for (const agentName of workflowReport.agents) {
      const prev = user.collaborativeMemory.agentPerformance[agentName] || { runs: 0, avgScore: 0.5 };
      const nextScore = workflowReport.metrics.agentPerformanceScore;
      prev.avgScore = clamp01(((prev.avgScore * prev.runs) + nextScore) / (prev.runs + 1));
      prev.runs += 1;
      user.collaborativeMemory.agentPerformance[agentName] = prev;
    }

    const knowledgeNote = `${workflowReport.mode}: consensus=${workflowReport.consensusConfidence.toFixed(2)}, evidence=${workflowReport.metrics.evidenceStrengthScore.toFixed(2)}, reasoning=${workflowReport.metrics.reasoningQualityScore.toFixed(2)}`;
    user.collaborativeMemory.sharedKnowledge.push({ ts: Date.now(), note: knowledgeNote });
    if (user.collaborativeMemory.sharedKnowledge.length > MAX_COLLAB_MEMORY) {
      user.collaborativeMemory.sharedKnowledge.shift();
    }

    user.collaborativeMemory.updatedAt = Date.now();
    if (typeof persist === 'function') {
      try {
        const result = persist();
        if (result && typeof result.catch === 'function') {
          result.catch((err) => observability.recordErrorPattern('collaborative_memory_persist', err));
        }
      } catch (err) {
        observability.recordErrorPattern('collaborative_memory_persist', err);
      }
    }
    observability.logEvent(traceId, 'AgentCoordinator', 'COLLABORATIVE_MEMORY_PERSISTED', {
      userId,
      mode: workflowReport.mode,
      consensusConfidence: workflowReport.consensusConfidence
    });
    return true;
  }

  getRuntimeSnapshot() {
    const recent = this.workflowHistory.slice(-10);
    const avgConsensus = recent.length
      ? recent.reduce((sum, item) => sum + clamp01(item.consensusConfidence), 0) / recent.length
      : 0;
    const agentActivationCounts = {};
    for (const item of recent) {
      for (const agentName of item.agents || []) {
        agentActivationCounts[agentName] = (agentActivationCounts[agentName] || 0) + 1;
      }
    }

    return {
      registeredAgentCount: Object.keys(AGENT_REGISTRY).length,
      recentWorkflowCount: recent.length,
      averageConsensusConfidence: Number(avgConsensus.toFixed(3)),
      agentActivationCounts,
      recentModes: recent.map((item) => item.mode).slice(-5)
    };
  }
}

module.exports = new AgentCoordinator();

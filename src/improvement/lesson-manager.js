'use strict';

const store = require('./improvement-store');
const utils = require('./improvement-utils');

function generateId() {
  return 'lesson_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
}

const VALID_STATUSES = new Set(['active', 'archived', 'superseded']);

function normalizeLesson(input) {
  const now = new Date().toISOString();
  return {
    id: input.id || generateId(),
    workspaceId: input.workspaceId || 'default',
    title: input.title || 'Untitled Lesson',
    summary: input.summary || '',
    category: input.category || 'general',
    sourceFeedbackIds: Array.isArray(input.sourceFeedbackIds) ? input.sourceFeedbackIds : [],
    sourceOutcomeIds: Array.isArray(input.sourceOutcomeIds) ? input.sourceOutcomeIds : [],
    affectedModules: Array.isArray(input.affectedModules) ? input.affectedModules : [],
    rule: input.rule || '',
    recommendation: input.recommendation || '',
    confidence: Math.max(0, Math.min(1, input.confidence || 0.7)),
    status: VALID_STATUSES.has(input.status) ? input.status : 'active',
    createdAt: input.createdAt || now,
    updatedAt: now
  };
}

async function createLessonFromFeedback(feedbackId, services) {
  const feedback = store.getFeedback(feedbackId);
  if (!feedback) {
    return { ok: false, reason: 'FEEDBACK_NOT_FOUND' };
  }

  const lesson = normalizeLesson({
    title: `Lesson from feedback: ${(feedback.title || feedback.text || '').slice(0, 60)}`,
    summary: (feedback.text || feedback.summary || '').slice(0, 300),
    category: 'feedback',
    sourceFeedbackIds: [feedbackId],
    affectedModules: feedback.modules || [feedback.module || 'unknown'].filter(Boolean),
    rule: '',
    recommendation: feedback.suggestion || feedback.recommendation || '',
    confidence: feedback.confidence || 0.6
  });

  store.addLesson(lesson);
  return { ok: true, lesson };
}

async function createLessonFromOutcome(outcomeId, services) {
  const outcome = store.getOutcome(outcomeId);
  if (!outcome) {
    return { ok: false, reason: 'OUTCOME_NOT_FOUND' };
  }

  const lesson = normalizeLesson({
    title: `Lesson from outcome: ${(outcome.title || outcome.summary || '').slice(0, 60)}`,
    summary: (outcome.summary || outcome.description || '').slice(0, 300),
    category: 'outcome',
    sourceOutcomeIds: [outcomeId],
    affectedModules: outcome.modules || [outcome.module || 'unknown'].filter(Boolean),
    rule: outcome.lesson || outcome.rule || '',
    recommendation: outcome.recommendation || '',
    confidence: outcome.confidence || 0.7
  });

  store.addLesson(lesson);
  return { ok: true, lesson };
}

async function createLessonFromWeakness(weaknessId, services) {
  const weakness = store.get(weaknessId);
  if (!weakness) {
    return { ok: false, reason: 'WEAKNESS_NOT_FOUND' };
  }

  const lesson = normalizeLesson({
    title: `Lesson from weakness: ${weakness.title}`,
    summary: weakness.summary,
    category: 'weakness',
    sourceFeedbackIds: [],
    sourceOutcomeIds: [],
    affectedModules: [weakness.module],
    rule: `Prevent: ${weakness.title}`,
    recommendation: `Address repeated ${weakness.module} weakness detected ${weakness.frequency} times`,
    confidence: Math.min(1, 0.5 + weakness.frequency * 0.1)
  });

  store.addLesson(lesson);
  return { ok: true, lesson };
}

async function createLesson(input, services) {
  const lesson = normalizeLesson(input);
  if (!lesson.title || lesson.title === 'Untitled Lesson') {
    return { ok: false, reason: 'LESSON_TITLE_REQUIRED' };
  }
  store.addLesson(lesson);
  return { ok: true, lesson };
}

async function listLessons(filters, services) {
  let results = store.listLessons(filters);
  if (filters) {
    if (filters.status) results = results.filter(l => l.status === filters.status);
    if (filters.category) results = results.filter(l => l.category === filters.category);
    if (filters.module) results = results.filter(l => l.affectedModules.includes(filters.module));
    if (filters.limit) results = results.slice(0, filters.limit);
  }
  return results;
}

async function searchLessons(query, services) {
  if (!query) return store.listLessons();
  const q = query.toLowerCase();
  return store.listLessons().filter(lesson =>
    lesson.title.toLowerCase().includes(q) ||
    lesson.summary.toLowerCase().includes(q) ||
    lesson.rule.toLowerCase().includes(q)
  );
}

async function archiveLesson(lessonId, reason, services) {
  const lesson = store.getLesson(lessonId);
  if (!lesson) return { ok: false, reason: 'LESSON_NOT_FOUND' };
  lesson.status = 'archived';
  lesson.updatedAt = new Date().toISOString();
  lesson.archiveReason = reason || 'No reason provided';
  store.updateLesson(lesson);
  return { ok: true, lesson };
}

async function linkLessonToKnowledgeGraph(lessonId, services) {
  try {
    const lesson = store.getLesson(lessonId);
    if (!lesson) return false;

    const kg = services.knowledgeGraph;
    if (!kg || typeof kg.createNode !== 'function') return false;

    const result = kg.createNode('system', {
      label: `lesson:${lesson.title.slice(0, 80)}`,
      type: 'lesson',
      summary: lesson.summary.slice(0, 500),
      tags: [...lesson.affectedModules, lesson.category],
      source: 'improvement-engine',
      sourceId: lesson.id,
      confidence: lesson.confidence
    }, services);

    return result && result.ok === true;
  } catch (_) {
    return false;
  }
}

const SEED_LESSONS = [
  {
    title: 'Bump PWA cache version after dashboard asset changes.',
    summary: 'PWA cache version must be incremented whenever dashboard static assets are modified to prevent stale content.',
    category: 'deployment',
    affectedModules: ['dashboard'],
    rule: 'Always bump the cache version constant in service worker after any dashboard asset change.',
    recommendation: 'Add a checklist item for cache version bump in the dashboard release process.',
    confidence: 0.95
  },
  {
    title: 'Stable public dashboard tabs must appear in sidebar.',
    summary: 'All known dashboard tabs must be registered in the sidebar. Unknown tabs may fall back to System Overview.',
    category: 'dashboard',
    affectedModules: ['dashboard'],
    rule: 'Every stable dashboard tab must have a corresponding sidebar entry. Unknown tabs fall back to Overview.',
    recommendation: 'When adding a new dashboard tab, always add it to the sidebar registry and the known tabs list.',
    confidence: 0.95
  },
  {
    title: 'Do not route personal/school questions to Coder.',
    summary: 'Personal, school, and emotional chat must be routed to orchestrator or reflection, not to Coder.',
    category: 'routing',
    affectedModules: ['routing', 'natural-language'],
    rule: 'Personal/school/emotional queries go to orchestrator/reflection. Coding/error/deploy goes to coder/ops/critic.',
    recommendation: 'Keep the agent routing rules updated in AGENTS.md and enforce in the natural language router.',
    confidence: 0.95
  },
  {
    title: 'External write requires Evaluation v2 + executor approval.',
    summary: 'Any write, external, or danger action must go through dry-run, Evaluation v2, proposal, approval, then run.',
    category: 'security',
    affectedModules: ['executor', 'operator'],
    rule: 'Write/external/danger actions must follow: dry-run → Evaluation v2 → executor proposal → approval → run.',
    recommendation: 'Never bypass the evaluation gate for external mutations. Enforce in operator-evaluation-gate.',
    confidence: 0.95
  },
  {
    title: 'Missing optional env must not crash app.',
    summary: 'The application should gracefully handle missing optional environment variables without crashing.',
    category: 'resilience',
    affectedModules: ['executor'],
    rule: 'All optional environment variables must have safe defaults or be guarded with try/catch.',
    recommendation: 'Audit env access throughout the codebase to ensure optional vars do not crash on missing.',
    confidence: 0.9
  },
  {
    title: 'Render deploy failure often starts from missing module or start script.',
    summary: 'Most Render deployment failures originate from a missing Node module or incorrect start script configuration.',
    category: 'deployment',
    affectedModules: ['deploy'],
    rule: 'Before deploying, verify all dependencies are installed and start script is correctly configured in package.json.',
    recommendation: 'Add a pre-deploy validation step that checks for missing modules and start script correctness.',
    confidence: 0.9
  }
];

function seedLessons(services) {
  const seeded = [];
  const existing = store.listLessons();
  const existingTitles = new Set(existing.map(l => l.title.toLowerCase()));

  for (const seed of SEED_LESSONS) {
    if (existingTitles.has(seed.title.toLowerCase())) continue;
    const lesson = normalizeLesson(seed);
    store.addLesson(lesson);
    seeded.push(lesson);
  }

  return seeded;
}

seedLessons();

module.exports = {
  createLessonFromFeedback,
  createLessonFromOutcome,
  createLessonFromWeakness,
  createLesson,
  listLessons,
  searchLessons,
  archiveLesson,
  linkLessonToKnowledgeGraph,
  seedLessons,
  SEED_LESSONS
};

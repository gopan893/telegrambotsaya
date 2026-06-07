'use strict';

const { now, truncate, maskSecrets } = require('./improvement-utils');

function generateImprovementSummary(workspaceId, services) {
  const store = getStore(services);
  const feedback = filterByWorkspace(store.getAll('feedback'), workspaceId);
  const plans = filterByWorkspace(store.getAll('plans'), workspaceId);
  const weaknesses = filterByWorkspace(store.getAll('weaknesses'), workspaceId);
  const lessons = filterByWorkspace(store.getAll('lessons'), workspaceId);
  const regressionCases = filterByWorkspace(store.getAll('regressionCases'), workspaceId);

  const topWeakness = findTopWeakness(weaknesses);
  const recentFeedback = feedback.slice(-5).reverse();
  const pendingPlans = plans.filter(p => p.status !== 'archived' && p.status !== 'executed');

  return {
    title: 'Improvement Summary',
    sections: [
      { heading: 'Overview', content: buildOverview(weaknesses, plans, lessons, regressionCases) },
      { heading: 'Top Repeated Weakness', content: topWeakness ? topWeakness.description || topWeakness.category || 'None' : 'None identified' },
      { heading: 'Recent Feedback', content: formatItems(recentFeedback, f => `[${f.sentiment}] ${f.summary}`) },
      { heading: 'Lessons Learned', content: formatItems(lessons, l => l.lesson || l.summary || '') },
      { heading: 'Suggested Regression Tests', content: formatItems(regressionCases, r => r.testDescription || r.title || '') },
      { heading: 'Improvement Plans', content: formatItems(plans, p => `[${p.status}] ${p.title}`) },
      { heading: 'Recommended Agent', content: findRecommendedAgent(weaknesses, lessons) },
      { heading: 'Pending Proposals', content: formatItems(pendingPlans, p => `${p.title} (${p.riskLevel || 'medium'})`) },
      { heading: 'Safety Warnings', content: buildSafetyWarnings(plans) },
    ],
    generatedAt: now(),
  };
}

function generateWeeklyImprovementReport(workspaceId, services) {
  const store = getStore(services);
  const feedback = filterByWorkspace(store.getAll('feedback'), workspaceId);
  const plans = filterByWorkspace(store.getAll('plans'), workspaceId);
  const weaknesses = filterByWorkspace(store.getAll('weaknesses'), workspaceId);
  const lessons = filterByWorkspace(store.getAll('lessons'), workspaceId);

  const weekOld = Date.now() - 7 * 24 * 3600 * 1000;
  const recentFeedback = feedback.filter(f => new Date(f.createdAt).getTime() > weekOld);
  const recentPlans = plans.filter(p => new Date(p.createdAt).getTime() > weekOld);
  const newWeaknesses = weaknesses.filter(w => new Date(w.createdAt).getTime() > weekOld);

  const sentimentCounts = countBy(recentFeedback, 'sentiment');
  const topWeakness = findTopWeakness(newWeaknesses);

  return {
    title: 'Weekly Improvement Report',
    sections: [
      { heading: 'Weekly Overview', content: `${recentFeedback.length} feedback, ${recentPlans.length} plans, ${newWeaknesses.length} new weaknesses` },
      { heading: 'Feedback Sentiment Breakdown', content: formatSentiment(sentimentCounts) },
      { heading: 'New Weaknesses', content: formatItems(newWeaknesses, w => w.description || w.category || '') },
      { heading: 'Top Weakness This Week', content: topWeakness ? topWeakness.description || topWeakness.category || 'None' : 'None identified' },
      { heading: 'Lessons Applied', content: formatItems(lessons, l => l.lesson || l.summary || '') },
      { heading: 'Plans Created', content: formatItems(recentPlans, p => `[${p.status}] ${p.title}`) },
      { heading: 'Recommended Focus', content: recommendFocus(newWeaknesses, recentFeedback) },
    ],
    generatedAt: now(),
  };
}

function generateLessonsReport(workspaceId, services) {
  const store = getStore(services);
  const lessons = filterByWorkspace(store.getAll('lessons'), workspaceId);
  const weaknesses = filterByWorkspace(store.getAll('weaknesses'), workspaceId);

  const lessonsByCategory = groupBy(lessons, 'category');

  return {
    title: 'Lessons Learned Report',
    sections: [
      { heading: 'Total Lessons', content: String(lessons.length) },
      { heading: 'Lessons by Category', content: formatGroupedItems(lessonsByCategory, l => l.lesson || l.summary || '') },
      { heading: 'Weaknesses Addressed', content: formatItems(weaknesses, w => w.description || w.category || '') },
      { heading: 'Recurring Themes', content: findRecurringThemes(lessons) },
      { heading: 'Action Items', content: buildLessonActionItems(lessons) },
    ],
    generatedAt: now(),
  };
}

function generateRegressionSuggestionsReport(workspaceId, services) {
  const store = getStore(services);
  const cases = filterByWorkspace(store.getAll('regressionCases'), workspaceId);
  const weaknesses = filterByWorkspace(store.getAll('weaknesses'), workspaceId);

  const byPriority = groupBy(cases, 'priority');

  return {
    title: 'Regression Suggestions Report',
    sections: [
      { heading: 'Total Regression Cases', content: String(cases.length) },
      { heading: 'Cases by Priority', content: formatGroupedItems(byPriority, r => r.testDescription || r.title || '') },
      { heading: 'Linked Weaknesses', content: formatCorrelatedItems(cases, weaknesses, 'weaknessId') },
      { heading: 'Suggested Test Coverage', content: suggestTestCoverage(cases) },
    ],
    generatedAt: now(),
  };
}

function generateQualityTrendReport(workspaceId, services) {
  const store = getStore(services);
  const feedback = filterByWorkspace(store.getAll('feedback'), workspaceId);
  const weaknesses = filterByWorkspace(store.getAll('weaknesses'), workspaceId);
  const lessons = filterByWorkspace(store.getAll('lessons'), workspaceId);

  const feedbackByCategory = groupBy(feedback, 'category');
  const sentimentByCategory = {};
  for (const [cat, items] of Object.entries(feedbackByCategory)) {
    sentimentByCategory[cat] = countBy(items, 'sentiment');
  }

  return {
    title: 'Quality Trend Report',
    sections: [
      { heading: 'Feedback by Category', content: formatGroupedItems(feedbackByCategory, f => `[${f.sentiment}] ${f.summary}`) },
      { heading: 'Sentiment per Category', content: formatSentimentMap(sentimentByCategory) },
      { heading: 'Weakness Trends', content: formatItems(weaknesses.slice(-10).reverse(), w => w.description || w.category || '') },
      { heading: 'Lesson Adoption', content: String(lessons.length) + ' lessons recorded' },
      { heading: 'Quality Score', content: computeQualityScore(feedback) },
    ],
    generatedAt: now(),
  };
}

function filterByWorkspace(items, workspaceId) {
  if (!workspaceId) return items || [];
  return (items || []).filter(item => item.workspaceId === workspaceId || !item.workspaceId);
}

function findTopWeakness(weaknesses) {
  const counts = {};
  for (const w of weaknesses || []) {
    const key = w.category || w.description || 'unknown';
    counts[key] = (counts[key] || 0) + 1;
  }
  const entries = Object.entries(counts);
  if (entries.length === 0) return null;
  entries.sort((a, b) => b[1] - a[1]);
  const topKey = entries[0][0];
  return weaknesses.find(w => (w.category || w.description || 'unknown') === topKey) || null;
}

function findRecommendedAgent(weaknesses, lessons) {
  const allText = [
    ...(weaknesses || []).map(w => w.description || w.category || ''),
    ...(lessons || []).map(l => l.lesson || l.category || ''),
  ].join(' ').toLowerCase();

  if (/coder|code|coding|debug|compile/i.test(allText)) return 'coder';
  if (/deploy|ops|operation|monitoring/i.test(allText)) return 'ops';
  if (/security|secret|token|privacy/i.test(allText)) return 'security';
  if (/proposal|evaluation|approval/i.test(allText)) return 'executor';
  if (/dashboard|ui|frontend|tampilan/i.test(allText)) return 'dashboard';
  if (/routing|telegram|command|intent/i.test(allText)) return 'telegram-control';
  return 'general';
}

function buildSafetyWarnings(plans) {
  const warnings = (plans || []).filter(p =>
    p.riskLevel === 'high' || p.riskLevel === 'danger'
  );
  if (warnings.length === 0) return 'No safety warnings';
  return warnings.map(w => `${w.title} (risk: ${w.riskLevel})`).join('\n');
}

function buildOverview(weaknesses, plans, lessons, regressionCases) {
  return [
    `Weaknesses: ${(weaknesses || []).length}`,
    `Plans: ${(plans || []).length}`,
    `Lessons: ${(lessons || []).length}`,
    `Regression Cases: ${(regressionCases || []).length}`,
  ].join('\n');
}

function formatItems(items, fn) {
  if (!items || items.length === 0) return 'None';
  return items.map(fn).filter(Boolean).join('\n');
}

function formatGroupedItems(grouped, fn) {
  const lines = [];
  for (const [key, items] of Object.entries(grouped || {})) {
    lines.push(`[${key}]`);
    for (const item of items) {
      const line = fn(item);
      if (line) lines.push('  - ' + line);
    }
  }
  return lines.length === 0 ? 'None' : lines.join('\n');
}

function formatSentiment(sentimentCounts) {
  return Object.entries(sentimentCounts)
    .map(([k, v]) => `${k}: ${v}`)
    .join(', ') || 'No data';
}

function formatSentimentMap(sentimentByCategory) {
  const lines = [];
  for (const [cat, sentiments] of Object.entries(sentimentByCategory || {})) {
    const parts = Object.entries(sentiments).map(([k, v]) => `${k}=${v}`).join(', ');
    lines.push(`${cat}: ${parts}`);
  }
  return lines.length === 0 ? 'No data' : lines.join('\n');
}

function computeQualityScore(feedback) {
  if (!feedback || feedback.length === 0) return 'No data';
  const positive = feedback.filter(f => f.sentiment === 'positive').length;
  const negative = feedback.filter(f => f.sentiment === 'negative').length;
  const total = feedback.length;
  const score = total > 0 ? Math.round((positive / total) * 100) : 0;
  return `${score}% positive (${positive}/${total})`;
}

function countBy(items, key) {
  const counts = {};
  for (const item of items || []) {
    const val = item[key] || 'unknown';
    counts[val] = (counts[val] || 0) + 1;
  }
  return counts;
}

function groupBy(items, key) {
  const grouped = {};
  for (const item of items || []) {
    const val = item[key] || 'uncategorized';
    if (!grouped[val]) grouped[val] = [];
    grouped[val].push(item);
  }
  return grouped;
}

function findRecurringThemes(lessons) {
  const themeCounts = {};
  for (const lesson of lessons || []) {
    const theme = lesson.category || 'general';
    themeCounts[theme] = (themeCounts[theme] || 0) + 1;
  }
  const sorted = Object.entries(themeCounts).sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0) return 'No recurring themes';
  return sorted.map(([theme, count]) => `${theme} (${count}x)`).join('\n');
}

function buildLessonActionItems(lessons) {
  const actionItems = (lessons || []).filter(l => l.actionItem || l.recommendation);
  if (actionItems.length === 0) return 'No action items';
  return actionItems.map(l => l.actionItem || l.recommendation || '').filter(Boolean).join('\n');
}

function formatCorrelatedItems(items, correlations, correlationKey) {
  if (!items || items.length === 0) return 'None';
  return items.map(item => {
    const corrId = item[correlationKey];
    const corr = (correlations || []).find(c => c.id === corrId);
    const corrName = corr ? corr.description || corr.category || corrId : (corrId || 'none');
    return `${item.testDescription || item.title || 'Unknown'} -> ${corrName}`;
  }).join('\n');
}

function suggestTestCoverage(cases) {
  if (!cases || cases.length === 0) return 'No coverage suggestions';
  const categories = groupBy(cases, 'category');
  const lines = Object.entries(categories).map(([cat, items]) =>
    `${cat}: ${items.length} case(s)`
  );
  return lines.join('\n');
}

function recommendFocus(weaknesses, feedback) {
  const negativeFeedback = (feedback || []).filter(f => f.sentiment === 'negative');
  if (negativeFeedback.length === 0 && (weaknesses || []).length === 0) {
    return 'No specific focus area identified';
  }
  const topW = findTopWeakness(weaknesses);
  const topNegativeCat = countBy(negativeFeedback, 'category');
  const sortedCats = Object.entries(topNegativeCat).sort((a, b) => b[1] - a[1]);
  const focusCat = sortedCats.length > 0 ? sortedCats[0][0] : null;
  const parts = [];
  if (topW) parts.push(`Address weakness: ${topW.description || topW.category}`);
  if (focusCat) parts.push(`Improve category: ${focusCat} (${sortedCats[0][1]} negative feedback)`);
  return parts.join('\n') || 'No specific focus area identified';
}

function getStore(services) {
  if (services && services.store) return services.store;
  return require('./improvement-store').getDefaultStore();
}

module.exports = {
  generateImprovementSummary,
  generateWeeklyImprovementReport,
  generateLessonsReport,
  generateRegressionSuggestionsReport,
  generateQualityTrendReport,
};

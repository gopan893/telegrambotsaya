'use strict';

const store = require('./collaboration-store');
const guards = require('./collaboration-guards');
const thinkingPartner = require('./thinking-partner');
const strategic = require('./strategic-thinking-engine');
const reflection = require('./reflection-system');
const critical = require('./critical-thinking-assistant');
const learning = require('./learning-intelligence');
const mentalModel = require('./mental-model-engine');
const decision = require('./decision-support');
const insightGenerator = require('./insight-generator');
const analytics = require('./collaboration-analytics');

function createResponse(command, text, userId, user) {
  const collab = store.ensureCollab(user);
  collab.analytics.sessions += 1;
  let output = '';

  if (command === '/think') output = thinkingPartner.think(text);
  if (command === '/strategy') output = strategic.format(strategic.analyze(text));
  if (command === '/reflect') {
    collab.analytics.reflections += 1;
    output = reflection.reflect(text);
  }
  if (command === '/learnplan') {
    collab.analytics.learningPlans += 1;
    output = learning.format(learning.buildLearningPlan(text));
  }
  if (command === '/mentalmodel') output = mentalModel.format(mentalModel.buildMentalModel(text));
  if (command === '/decision') {
    collab.analytics.decisions += 1;
    output = decision.format(decision.analyzeDecision(text));
    store.appendBounded(collab.decisions, { text, createdAt: new Date().toISOString() });
  }
  if (command === '/blindspot') output = critical.blindspots(text);
  if (command === '/assumptions') output = critical.assumptions(text);
  if (command === '/perspectives') output = critical.perspectives(text);
  if (command === '/insight') {
    const insight = insightGenerator.createInsight(userId, text, 'telegram-command');
    store.appendBounded(collab.insights, insight);
    output = `Insight tersimpan: ${insight.id}\nContent: ${insight.content}\nConfidence: ${insight.confidence.toFixed(2)}`;
  }
  if (command === '/journal') {
    if (text) {
      store.appendBounded(collab.journal, {
        id: `jr_${Date.now()}`,
        content: text,
        createdAt: new Date().toISOString()
      });
      output = `Journal tersimpan.\n\n${reflection.reflect(text)}`;
    } else {
      output = (collab.journal || []).slice(-8).map((item, index) => `${index + 1}. ${item.createdAt}: ${item.content}`).join('\n') || 'Journal masih kosong.';
    }
  }
  if (command === '/collab') {
    const summary = analytics.summarize(collab);
    output = [
      'Human-AI Collaboration Status',
      `Sessions: ${summary.sessions}`,
      `Insights: ${summary.insights}`,
      `Journal: ${summary.journalEntries}`,
      `Decisions: ${summary.decisions}`,
      `Reflections: ${summary.reflections}`,
      `Learning plans: ${summary.learningPlans}`
    ].join('\n');
  }

  const note = guards.addHumanJudgmentNote(text);
  return note ? `${output}\n\n${note}` : output;
}

module.exports = {
  createResponse
};

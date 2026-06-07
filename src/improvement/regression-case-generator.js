'use strict';

const { generateId, now, truncate, sanitizeImprovementText, maskSecrets } = require('./improvement-utils');

const RISK_LEVELS = ['low', 'medium', 'high'];

function normalizeRiskLevel(val) {
  if (RISK_LEVELS.includes(val)) return val;
  return 'low';
}

function estimateRisk(weakness) {
  const text = [weakness.title, weakness.description, weakness.impact].filter(Boolean).join(' ').toLowerCase();
  const highWords = ['critical', 'crash', 'data loss', 'security', 'secret', 'deploy failed', 'downtime', 'corruption'];
  const medWords = ['error', 'bug', 'incorrect', 'regression', 'broken', 'failing', 'slow'];
  if (highWords.some(w => text.includes(w))) return 'high';
  if (medWords.some(w => text.includes(w))) return 'medium';
  return 'low';
}

function generateRegressionCaseFromWeakness(weaknessId, services = {}) {
  const store = services.store;
  if (!store) throw new Error('services.store is required');

  const weakness = store.getById('weaknesses', weaknessId);
  if (!weakness) throw new Error(`Weakness not found: ${weaknessId}`);

  const id = generateId();
  const title = `Regression: ${truncate(weakness.title, 100)}`;
  const targetModule = weakness.targetModule || weakness.affectedModule || 'unknown';
  const testFileSuggestion = suggestTestFileForRegression({ targetModule, title }, services);
  const riskLevel = estimateRisk(weakness);

  const caseItem = {
    id,
    title,
    targetModule,
    testFileSuggestion,
    scenario: `Verify that the issue described in weakness "${weakness.title}" does not recur. Reproduce the original failure condition and confirm it no longer occurs.`,
    expectedBehavior: weakness.expectedBehavior || `The system should handle the scenario described in ${weakness.title} without the previously observed failure.`,
    failureToPrevent: truncate(weakness.description || weakness.title, 300),
    riskLevel,
    manualTestSteps: buildManualStepsFromItem(weakness, riskLevel),
    sourceWeaknessId: weaknessId,
    createdAt: now(),
    updatedAt: now()
  };

  return caseItem;
}

function generateRegressionCaseFromIncident(incidentId, services = {}) {
  if (!services.incidentStore) throw new Error('services.incidentStore is required');

  const getIncident = services.incidentStore.getIncident || services.incidentStore.get;
  if (typeof getIncident !== 'function') throw new Error('incidentStore must have a getIncident or get method');

  const incident = getIncident(incidentId, services);
  if (!incident) throw new Error(`Incident not found: ${incidentId}`);

  const id = generateId();
  const title = `Regression: ${truncate(incident.title || 'Incident regression', 100)}`;
  const targetModule = incident.affectedSystems?.[0] || 'unknown';
  const testFileSuggestion = suggestTestFileForRegression({ targetModule, title, incident }, services);
  const riskLevel = normalizeRiskLevel(incident.severity === 'critical' ? 'high' : incident.severity === 'major' ? 'medium' : 'low');

  const caseItem = {
    id,
    title,
    targetModule,
    testFileSuggestion,
    scenario: `Reproduce the production incident "${incident.title}" and verify the fix is effective. Follow the timeline and root cause hypothesis to construct the failing scenario.`,
    expectedBehavior: 'After applying the fix, the system should handle the incident trigger without failure.',
    failureToPrevent: truncate(incident.summary || incident.title, 300),
    riskLevel,
    manualTestSteps: buildManualStepsFromIncident(incident, riskLevel),
    sourceIncidentId: incidentId,
    createdAt: now(),
    updatedAt: now()
  };

  return caseItem;
}

function generateRegressionCaseFromFeedback(feedbackId, services = {}) {
  const store = services.store;
  if (!store) throw new Error('services.store is required');

  const feedback = store.getById('feedback', feedbackId);
  if (!feedback) throw new Error(`Feedback not found: ${feedbackId}`);

  const id = generateId();
  const title = `Regression: ${truncate(feedback.title || feedback.summary || 'Feedback regression', 100)}`;
  const targetModule = feedback.targetModule || feedback.module || 'unknown';
  const testFileSuggestion = suggestTestFileForRegression({ targetModule, title, feedback }, services);
  const riskLevel = estimateRisk({ title: feedback.title, description: feedback.description, impact: feedback.impact });

  const caseItem = {
    id,
    title,
    targetModule,
    testFileSuggestion,
    scenario: `Validate the improvement requested in feedback "${feedback.title || feedback.summary}" by testing that the described issue no longer exists.`,
    expectedBehavior: feedback.expectedBehavior || `The system should address the feedback "${feedback.title || feedback.summary}" without introducing side effects.`,
    failureToPrevent: truncate(feedback.description || feedback.summary || feedback.title, 300),
    riskLevel,
    manualTestSteps: buildManualStepsFromItem(feedback, riskLevel),
    sourceFeedbackId: feedbackId,
    createdAt: now(),
    updatedAt: now()
  };

  return caseItem;
}

function suggestTestFileForRegression(caseInput, services = {}) {
  const module = caseInput.targetModule || 'unknown';
  const base = module.replace(/^src\//, '').replace(/\.js$/, '');
  const parts = base.split('/');
  const testDir = parts.length > 1 ? parts.slice(0, -1).join('/') : '';
  const testName = parts[parts.length - 1] || 'unknown';
  const timestamp = Date.now().toString(36);

  if (testDir) {
    return `scratch/test-regression-${testName}-${timestamp}.js`;
  }
  return `scratch/test-regression-${module.replace(/[^a-zA-Z0-9_-]/g, '-')}-${timestamp}.js`;
}

function buildRegressionCaseSpec(caseInput, services = {}) {
  const spec = {
    title: caseInput.title || 'Regression case',
    targetModule: caseInput.targetModule || caseInput.module || 'unknown',
    testFileSuggestion: caseInput.testFileSuggestion || suggestTestFileForRegression(caseInput, services),
    scenario: caseInput.scenario || 'Run the system through the scenario that previously caused failure.',
    expectedBehavior: caseInput.expectedBehavior || 'No unexpected behavior should occur.',
    failureToPrevent: truncate(caseInput.failureToPrevent || caseInput.description || caseInput.summary || '', 300),
    riskLevel: normalizeRiskLevel(caseInput.riskLevel),
    manualTestSteps: Array.isArray(caseInput.manualTestSteps) ? caseInput.manualTestSteps : ['Run the application', 'Trigger the scenario', 'Verify no failure']
  };

  return spec;
}

function buildManualStepsFromItem(item, riskLevel) {
  const steps = [
    `Ensure the target module (${item.targetModule || item.module || 'unknown'}) is running in a test environment`
  ];
  if (item.scenario) {
    steps.push(`Reproduce scenario: ${item.scenario}`);
  }
  steps.push(`Observe behavior and verify no unexpected errors`);
  if (riskLevel === 'high') {
    steps.push(`Check system logs for related error entries`);
    steps.push(`Verify no data corruption or state issues`);
  }
  steps.push(`Document the result`);
  return steps;
}

function buildManualStepsFromIncident(incident, riskLevel) {
  const steps = [
    `Set up a test environment that mirrors the production state at time of incident`
  ];
  steps.push(`Trigger the conditions described in the incident timeline`);
  steps.push(`Verify the fix prevents the failure`);
  if (riskLevel === 'high') {
    steps.push(`Run load test to confirm no performance regression`);
    steps.push(`Verify related monitoring alerts are clear`);
  }
  steps.push(`Document the result`);
  return steps;
}

module.exports = {
  generateRegressionCaseFromWeakness,
  generateRegressionCaseFromIncident,
  generateRegressionCaseFromFeedback,
  suggestTestFileForRegression,
  buildRegressionCaseSpec
};

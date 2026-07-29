'use strict';

const autonomy = require('../index');

describe('autonomy exports', () => {
  test('exports all factories', () => {
    expect(autonomy.createAutonomyScheduler).toBeDefined();
    expect(autonomy.createDurableQueue).toBeDefined();
    expect(autonomy.createWorktreeSandbox).toBeDefined();
    expect(autonomy.createQualityGate).toBeDefined();
    expect(autonomy.createAgentWorkflow).toBeDefined();
    expect(autonomy.createOperationsMonitor).toBeDefined();
  });
});

'use strict';

const { createAgentWorkflow } = require('../agent-workflow');

describe('agent workflow', () => {
  test('progresses sequentially and saves output of planner, coder, reviewer, deployer', async () => {
    const data = {};
    const storageManager = {
      safeRead: jest.fn(async (key, fallback) => data[key] || fallback),
      safeWrite: jest.fn(async (key, value) => { data[key] = value; })
    };

    const runPlanner = jest.fn(async () => ({ plan: 'test-plan' }));
    const runCoder = jest.fn(async () => ({ file: 'src/a.js', patch: 'add' }));
    const runReviewer = jest.fn(async () => ({ ok: true, score: 100 }));
    const runDeployer = jest.fn(async () => ({ deployed: true }));

    const wf = createAgentWorkflow({
      storageManager,
      callbacks: {
        planner: runPlanner,
        coder: runCoder,
        reviewer: runReviewer,
        deployer: runDeployer
      }
    });

    const session = await wf.start({ goal: 'implement translation' });
    expect(session.status).toBe('planning');

    // Tick 1: planning
    await wf.tick(session.id);
    expect(runPlanner).toHaveBeenCalledTimes(1);

    // Tick 2: coding
    await wf.tick(session.id);
    expect(runCoder).toHaveBeenCalledTimes(1);

    // Tick 3: reviewing
    await wf.tick(session.id);
    expect(runReviewer).toHaveBeenCalledTimes(1);

    // Tick 4: deploying
    await wf.tick(session.id);
    expect(runDeployer).toHaveBeenCalledTimes(1);

    const finalSession = await wf.getSession(session.id);
    expect(finalSession.status).toBe('done');
    expect(finalSession.outputs.planner).toEqual({ plan: 'test-plan' });
  });
});

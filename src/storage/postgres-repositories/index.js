'use strict';

const { createUsersRepository } = require('./users-repository');
const { createMemoriesRepository } = require('./memories-repository');
const { createGoalsRepository } = require('./goals-repository');
const { createWorkflowsRepository } = require('./workflows-repository');
const { createGraphRepository } = require('./graph-repository');
const { createInsightsRepository } = require('./insights-repository');
const { createTelemetryRepository } = require('./telemetry-repository');
const { createIncidentsRepository } = require('./incidents-repository');

function createPostgresRepositories(pool) {
  return {
    graph: createGraphRepository(pool),
    goals: createGoalsRepository(pool),
    incidents: createIncidentsRepository(pool),
    insights: createInsightsRepository(pool),
    memories: createMemoriesRepository(pool),
    telemetry: createTelemetryRepository(pool),
    users: createUsersRepository(pool),
    workflows: createWorkflowsRepository(pool)
  };
}

module.exports = {
  createPostgresRepositories
};

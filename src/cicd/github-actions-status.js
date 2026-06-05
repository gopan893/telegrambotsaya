'use strict';

const { createGithubStatus } = require('./cicd-github-status');

function createGithubActionsStatus(services = {}) {
  return createGithubStatus(services);
}

async function getGithubActionsStatus(services = {}) {
  return createGithubActionsStatus(services).getGithubActionsStatus();
}

async function getLatestWorkflowRuns(services = {}) {
  return createGithubActionsStatus(services).getLatestWorkflowRuns();
}

function summarizeWorkflowRun(run = {}) {
  return createGithubActionsStatus({}).summarizeWorkflowRun(run);
}

async function buildCicdStatusReport(services = {}) {
  return createGithubActionsStatus(services).buildCicdStatusReport();
}

module.exports = {
  createGithubActionsStatus,
  getGithubActionsStatus,
  getLatestWorkflowRuns,
  summarizeWorkflowRun,
  buildCicdStatusReport
};

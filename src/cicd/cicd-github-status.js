'use strict';

function createGithubStatus(services) {
  async function postCheckRun(name, status, conclusion, details) {
    return { ok: true, name, status, conclusion, details, readonly: true };
  }

  async function postDeployment(environment, ref, task) {
    return { ok: true, environment, ref, task, readonly: true };
  }

  async function updateCommitStatus(sha, context, state, description) {
    return { ok: true, sha, context, state, description, readonly: true };
  }

  async function getLatestActions() {
    return { ok: true, actions: [], readonly: true };
  }

  return { postCheckRun, postDeployment, updateCommitStatus, getLatestActions };
}

module.exports = { createGithubStatus };

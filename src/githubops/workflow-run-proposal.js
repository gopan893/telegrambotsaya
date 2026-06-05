'use strict';

const utils = require('./githubops-utils');
const store = require('./githubops-store');

const KNOWN_WORKFLOWS = ['ci.yml', 'release-check.yml', 'dashboard-regression.yml', 'dev-governance.yml'];

function listAvailableWorkflows(services) {
  const fs = require('fs');
  const path = require('path');
  const workflowsDir = path.join(services?.repoRoot || process.cwd(), '.github', 'workflows');
  try {
    const files = fs.readdirSync(workflowsDir);
    return files.filter(f => f.endsWith('.yml') || f.endsWith('.yaml')).map(f => ({
      filename: f,
      path: path.join('.github', 'workflows', f),
      known: KNOWN_WORKFLOWS.includes(f)
    }));
  } catch (_) {
    return KNOWN_WORKFLOWS.map(f => ({ filename: f, path: path.join('.github', 'workflows', f), known: true }));
  }
}

function createWorkflowRunProposal(workflowName, ref, services) {
  const available = listAvailableWorkflows(services);
  const workflow = available.find(w => w.filename === workflowName);
  if (!workflow) return { ok: false, error: `Workflow "${workflowName}" not found. Available: ${available.map(w => w.filename).join(', ')}` };

  const proposalId = utils.shortId();
  const proposal = {
    id: proposalId,
    type: 'workflow_run',
    workflow: workflow.filename,
    workflowPath: workflow.path,
    ref: ref || 'main',
    validation: {
      evaluationV2: 'not_run',
      tests: 'not_run'
    },
    executorApproval: null,
    executorApprovedAt: null,
    executorProposedTo: null,
    status: 'pending_approval',
    warnings: [],
    timestamp: utils.now()
  };

  proposal.warnings.push('Workflow dispatch triggers CI/CD — executor approval required');

  store.addWorkflowRunProposal(proposal);
  return { ok: true, proposal };
}

function approveWorkflowRunProposal(proposalId, executorId) {
  const proposals = store.getWorkflowRunProposals();
  const proposal = proposals.find(p => p.id === proposalId);
  if (!proposal) return { ok: false, error: 'Proposal not found' };
  if (proposal.executorApproval === 'approved') return { ok: false, error: 'Already approved' };

  proposal.executorApproval = 'approved';
  proposal.executorApprovedAt = utils.now();
  proposal.executorProposedTo = executorId;
  proposal.status = 'approved';
  return { ok: true, proposal };
}

function rejectWorkflowRunProposal(proposalId, reason, executorId) {
  const proposals = store.getWorkflowRunProposals();
  const proposal = proposals.find(p => p.id === proposalId);
  if (!proposal) return { ok: false, error: 'Proposal not found' };

  proposal.executorApproval = 'rejected';
  proposal.rejectionReason = reason || 'No reason given';
  proposal.executorApprovedAt = utils.now();
  proposal.executorProposedTo = executorId;
  proposal.status = 'rejected';
  return { ok: true, proposal };
}

function listWorkflowRunProposals(filters) {
  const all = store.getWorkflowRunProposals();
  if (!filters) return all;
  const { status, limit } = filters;
  let filtered = all;
  if (status) filtered = filtered.filter(p => p.status === status);
  if (limit) filtered = filtered.slice(0, limit);
  return filtered;
}

module.exports = {
  listAvailableWorkflows,
  createWorkflowRunProposal,
  approveWorkflowRunProposal,
  rejectWorkflowRunProposal,
  listWorkflowRunProposals
};

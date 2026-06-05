# CI/CD Pipeline

## Overview
Read-only CI/CD pipeline integration with GitHub Actions and quality gates.

## Components
- `cicd-store.js`: Persistent storage for releases, proposals, pipelines
- `cicd-github-status.js`: GitHub status API wrappers (read-only)
- `cicd-quality-gate.js`: Quality checks including evaluation score threshold
- `cicd-proposal.js`: Creates release proposals via executor system
- `cicd-routes.js`: Dashboard API routes for CI/CD data

## Release Process
1. Quality gate runs checks (env config, evaluation score, safety)
2. If checks pass, a release proposal is created via executor
3. Proposal requires approval before execution
4. GitHub Actions workflows are triggered on push/dispatch

## Workflows
- `ci.yml`: Runs on push/PR — loads all Phase 33 modules
- `release-check.yml`: Manual dispatch for release verification
- `dashboard-regression.yml`: Runs on dashboard file changes

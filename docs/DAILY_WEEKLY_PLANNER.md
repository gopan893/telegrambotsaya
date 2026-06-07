# Daily And Weekly Planner

Life OS daily and weekly planners keep plans intentionally small.

## Daily Plan

`src/lifeos/daily-planner.js` creates a short plan with:

- top 3 priorities
- one project task
- one personal task
- one habit
- one focus block
- one break/rest reminder
- one reflection question
- pending approvals
- project-life balance recommendation

The daily planner rejects secret-like input and audits plan creation.

## Weekly Plan

`src/lifeos/weekly-planner.js` creates a weekly plan with:

- main goal of the week
- project priorities
- personal priorities
- habits
- maintenance tasks
- risk/blocker summary
- recommended Codex/OpenCode/Hermes usage if project-related

## Design Rule

The planner should reduce overload, not create pressure. When energy is low or commitments are too many, Life OS recommends smaller scope and rest-first planning.

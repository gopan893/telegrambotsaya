# Rollback System

## Flow
1. Deploy fails or is detected unhealthy
2. Rollback plan created (links to failed deploy plan)
3. Last known good release detected
4. Rollback risk summary generated
5. Rollback proposal created
6. Evaluation v2 runs
7. Executor proposal created
8. User approves rollback
9. Rollback executes (git revert + push)
10. Post-rollback checks run

## Rules
- Rollback is an external action
- Rollback requires Evaluation v2 + executor approval
- No auto rollback — explicit approval required
- If no known good release, manual recovery guide generated
- Rollback proposal creation does not execute rollback

## Security
- Never expose env values in rollback reports
- Never execute rollback directly from bot runtime
- Rollback plan shows target commit/branch, not secrets

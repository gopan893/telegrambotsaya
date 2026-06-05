# OPEN_CODE_RECOVERY_AUDIT.md

## When to Use This File

Use this template when:
- Codex token runs out mid-task
- No handoff file exists
- You need to reconstruct context from git diff

---

## Recovery Audit Template

### Git Diff Summary

```
<paste git diff --stat output here>
```

### Files Changed by Previous Agent

| File | Change |
|---|---|
| ... | ... |

### Likely Completed Work

- ...

### Likely Unfinished Work

- ...

### Suspected Broken Imports/Routes/Renderers

| File | Suspected Issue |
|---|---|
| ... | ... |

### Dashboard Route Status

| Tab | Frontend Renderer | Backend Route | Status |
|---|---|---|---|
| ... | ... | ... | ... |

### Executor Boundary Status

- [ ] Proposal ≠ execution
- [ ] Approve/run separated
- [ ] No self-approve

### Integration Eval v2 Gate Status

- [ ] Write actions require Eval v2
- [ ] Dry-run does not execute
- [ ] No credential leak

### Natural Chat Routing Status

- [ ] Personal → Orchestrator/Reflection
- [ ] Coding → Coder/Ops/Critic
- [ ] Danger → Security/Executor

### Tests Available

| Test | Status |
|---|---|
| ... | ... |

### Recommended Minimal Patch Order

1. ...
2. ...
3. ...

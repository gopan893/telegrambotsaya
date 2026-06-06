# Root Cause Analysis

Phase 37 root cause analysis is heuristic and concise. It does not expose hidden chain-of-thought.

## Signals

- Recent deploy / Render / release references.
- GitHub Actions / CI references.
- Dashboard route guard or UI failures.
- Env/storage/cache references.
- Sanitized incident timeline signals.

## Output

```js
{
  confidence,
  likelyCause,
  evidence,
  affectedFiles,
  recommendedNextChecks,
  recommendedMitigation
}
```

If data is insufficient, the analyzer says so and recommends read-only next checks.

## Boundaries

Root cause analysis never:

- Executes shell commands from the bot runtime.
- Mutates repo files.
- Pushes to GitHub.
- Deploys or rolls back Render.
- Prints env values or credentials.

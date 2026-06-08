# Action Policy Simulator

## Overview

The Action Policy Simulator (`src/governance/action-policy-simulator.js`) allows safe simulation of any action against the unified governance policy without executing the action.

## Usage

### Simulate an action
```javascript
const simulation = actionPolicySimulator.simulateActionPolicy(
  { name: 'github.push.propose', actionType: 'external_write' },
  { id: 'user123' },
  { payload: '...' }
);
```

### Simulate a Telegram command
```javascript
const simulation = actionPolicySimulator.simulateTelegramCommand('/capabilities', [], { id: 'user123' });
```

### Simulate natural intent
```javascript
const simulation = actionPolicySimulator.simulateNaturalIntent('bolehkah bot push ke GitHub langsung?', { id: 'user123' });
```

### Simulate module capability
```javascript
const simulation = actionPolicySimulator.simulateModuleCapability('githubops.push.propose', { id: 'user123' });
```

### Build report
```javascript
const report = actionPolicySimulator.buildPolicySimulationReport(simulation);
```

## Simulation Output

```json
{
  "action": "github.push.propose",
  "capability": { "id": "githubops.push.propose", "module": "githubops", "riskLevel": "high" },
  "risk": { "riskLevel": "high", "riskScore": 0.78 },
  "permission": { "allowed": true, "role": "user" },
  "approval": { "requiresApproval": true, "requiresExecutor": true },
  "evaluation": { "evaluationRequired": true },
  "secretScan": { "hasSecret": false },
  "simulatedOutcome": "require_evaluation",
  "allowed": true
}
```

## Rules
- Simulation never executes the action
- Useful for dashboard and debugging
- No secrets in report
- All outputs are sanitized

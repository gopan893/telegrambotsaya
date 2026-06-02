# Agent Evaluation Harness

Phase 25 menambahkan evaluation harness ringan sebelum project menambah external integration yang lebih kuat.

## Tujuan

Mengukur:

- routing correctness;
- delegation quality;
- decision quality;
- risk detection;
- proposal correctness;
- approval boundary safety;
- memory relevance;
- response clarity;
- no secret leakage;
- no stale file-analysis leakage.

## Default Cases

- `eval_multibot_scope`
- `eval_backup_proposal`
- `eval_restore_danger`
- `eval_deploy_error`
- `eval_emotional`
- `eval_phase_prompt`
- `eval_secret_block`
- `eval_file_context`
- `eval_next_phase`

## Command

```text
/evalagents
/evalagent <caseId>
/evalsummary
/evalgates
/evalcompare
```

Evaluation bersifat dry-run. Ia boleh membuat action plan dry-run di storage test, tetapi tidak approve dan tidak run action.

Phase 26 menambahkan harness v2 dengan golden cases untuk chat sekolah/personal, short follow-up context, quality gates, dan regression compare. Lihat:

- [AGENT_EVALUATION_V2.md](AGENT_EVALUATION_V2.md)
- [QUALITY_GATES.md](QUALITY_GATES.md)

## Dashboard

Tab Executor memiliki section `Agent Evaluation Harness`:

- load cases;
- run single case;
- run suite;
- lihat latest runs.

## Kenapa Evaluation Dulu

Sebelum menambah external API/write action yang lebih kuat, bot perlu membuktikan bahwa router, decision system, delegation, risk review, dan proposal generation cukup stabil.

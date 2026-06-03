# Integration Evaluation Gate

Integration Evaluation Gate menghubungkan connector eksternal dengan Agent Evaluation Harness v2.

## Kenapa Wajib

Sebelum proposal executor dibuat untuk write/external/danger action, sistem harus membuktikan secara dry-run bahwa:

- action membutuhkan approval;
- tidak ada aksi eksternal berjalan;
- tidak ada secret leak;
- router memilih agent yang sesuai;
- output tidak membawa router debug atau metadata file stale.

## Alur

1. `buildIntegrationEvaluationCase()` membuat case dari connector/action.
2. `runEvaluationGateForIntegration()` menjalankan evaluator v2.
3. Gate mengecek:
   - `externalWriteApprovalScore`
   - `credentialSafetyScore`
   - `noExternalWriteDryRunScore`
   - `integrationEvaluationGateScore`
4. Jika gate gagal, pipeline status menjadi `blocked`.
5. `createExecutorProposalAfterGate()` menolak membuat proposal sampai evaluation passed.

## Dry-Run Safety

Evaluation tidak:

- mengirim Telegram message;
- approve proposal;
- run executor;
- memanggil external write API;
- menyimpan raw secret.

## Test Utama

- `scratch/test-integration-evaluation-gate.js`
- `scratch/test-integration-proposal-pipeline.js`
- `scratch/test-integration-execution-natural-chat.js`

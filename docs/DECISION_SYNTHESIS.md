# Decision Synthesis

Decision Synthesis mengubah opini council, kritik, dan risk review menjadi satu jawaban akhir yang bisa langsung dipakai user.

## Output

Synthesis menghasilkan:

- recommendation
- pros
- cons
- risks
- nextSteps
- confidence
- approvalRequired
- finalAnswer

Untuk normal chat, `finalAnswer` harus bersih dan tidak berisi debug router.

## Contoh

Input:

```text
saya bingung lanjut phase berapa
```

Output ringkas:

```text
Menurut saya lanjut ke Phase 22 — Agent Council + Internal Debate Engine.
...
Langkah berikutnya:
1. Batasi Phase 22 ke quick council...
```

Input berisiko:

```text
saya ingin restore backup production
```

Output wajib menyebut:

- jangan restore langsung
- buat proposal atau preview
- perlu approval eksplisit
- cek integrity/checksum

## Guard

- Secret-like input ditolak sebelum disimpan.
- Secret-like output dimask.
- Write/external/danger tidak pernah dijalankan oleh synthesis.
- `/router` dan dashboard router test tetap boleh menampilkan diagnostics.
- Natural chat tidak menampilkan `Mode`, `Risk`, raw `Agent`, atau object policy.

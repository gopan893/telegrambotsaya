# PWA Dashboard

Dashboard Telegram AI OS dapat dipasang di Android melalui browser yang mendukung PWA.

## Cara Install

1. Buka `/dashboard` dari URL Render.
2. Login dengan `DASHBOARD_ADMIN_TOKEN`.
3. Jika tombol install muncul di Settings, tekan **Install Dashboard**.
4. Jika tombol tidak muncul, gunakan menu browser dan pilih **Add to Home screen**.

## Cache Policy

Service worker hanya cache static shell:

- `/dashboard`
- CSS dan JavaScript dashboard
- manifest PWA
- icon dashboard

Service worker tidak cache:

- `/api/dashboard/*`
- response backup/export JSON
- data user, memory, goal, workflow, graph
- header `Authorization`

Jika offline, shell dashboard tetap bisa terbuka, tetapi endpoint data tetap membutuhkan koneksi server.

## Safety

- Tidak ada secret/env/token di manifest atau service worker.
- API data selalu network-only.
- Tombol **Clear App Cache** hanya membersihkan cache static shell.

## Known Limitations

- Belum ada push notification.
- Belum ada native Android/iOS app.
- Install prompt tergantung browser.

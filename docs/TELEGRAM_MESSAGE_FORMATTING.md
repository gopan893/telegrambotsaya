# Telegram Message Formatting Policy

## Format yang Didukung
- HTML: tag b, strong, i, em, u, ins, s, strike, del, a, code, pre
- Markdown: **bold**, __underline__

## Proteksi
- Secret/token otomatis di-[REDACTED]
- Stack trace tidak pernah ditampilkan
- Code block tidak rusak saat split

## Fallback
- Jika HTML/Markdown error → fallback ke plain text
- Jika formatting risk tinggi → fallback ke plain text

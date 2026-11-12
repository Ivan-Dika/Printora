# Deploy Docker
Berkas di `sites/rumah-printing-tajinan/`: `Dockerfile`, `.dockerignore`, `docker-compose.yml` (db MySQL 8.4 + app + WAHA), `.env.docker.example`.
Pakai: `cp .env.docker.example .env.docker` (isi sandi) lalu `docker compose --env-file .env.docker up -d --build`. Port hanya 127.0.0.1 (app 8787, WAHA 3000).

## Status (2026-11-13)
- Image app terbangun (~970 MB). App + db naik, healthy, jalan sebagai user `node`; data tetap setelah restart (volume `printora-db`, `printora-uploads`).
- Tes terhadap kontainer: API 151/151 (ENABLE_DEMO_PAY=1, MOCK_HOST=host.docker.internal), UI 46/46.
- Perbaikan saat uji: `npm prune --omit=dev` membuang vinext sehingga `npx` mengunduh versi lain saat jalan -> prune dihapus dan CMD memakai `node_modules/.bin/vinext`.
- Temuan keamanan: endpoint QRIS simulasi (`/api/bayar/demo`) bisa menandai lunas siapa pun yang memegang token. Sekarang dikendalikan `ENABLE_DEMO_PAY` (default 1 lokal; compose default 0). Bila 0: halaman simulasi 403 dan FO mengonfirmasi QRIS manual. QRIS sungguhan butuh gateway + webhook bertanda tangan.
- WAHA: image terunduh, `up` OK, terjangkau dari app di `http://waha:3000`; uji kirim dari Pengaturan: key benar -> 422 (sesi belum dipindai, wajar), key salah -> 401 pesan jelas. Scan QR dengan ponsel belum dilakukan (butuh pengguna).
- Tes pesan WA/email dari host ke kontainer: set `MOCK_HOST=host.docker.internal`.

## Sisa
Stack uji `printora-uji` dan `.env.docker` uji sudah dihapus (volume ikut). Untuk pakai sungguhan: buat `.env.docker` baru, `up -d --build`, buka http://127.0.0.1:3000 (admin / WAHA_DASHBOARD_PASSWORD) untuk memulai sesi dan scan QR, isi Pengaturan Admin (WAHA http://waha:3000, API key), lalu online: user memilih "lokal dulu"; opsi nanti Cloudflare Tunnel atau Caddy. SMTP: hanya SMTP luar (isi di Pengaturan Admin).

## Cloudflare Quick Tunnel (2026-11-13)
- Layanan `tunnel` (cloudflare/cloudflared) di docker-compose.yml, profile `tunnel`, target http://app:8787. Nyalakan: `docker compose --env-file .env.docker --profile tunnel up -d tunnel`; alamat acak: `... logs tunnel`. Matikan: `... stop tunnel`. Alamat berubah tiap container dibuat ulang.
- Batas Cloudflare ~100 MB per permintaan, jadi unggahan >100 MB gagal lewat tunnel (batas app 500 MB hanya berlaku lokal/LAN).
- Temuan: `sameOrigin` (lib/api.ts) membandingkan Origin dengan origin req.url (http di belakang tunnel) -> POST 403. Diperbaiki: bandingkan host saja (x-forwarded-host/host). Diuji: salah sandi -> 401, Origin asing -> 403.
- Sebelum dibuka ke publik: ganti <sandi-lokal>, ENABLE_DEMO_PAY=0, isi "Alamat situs" di Pengaturan dengan alamat tunnel.
- Keamanan: clientIp kini memakai entri paling kanan X-Forwarded-For (yang ditambahkan Cloudflare); login juga dibatasi 40/jam per akun tanpa IP (lib/auth.mjs). Diuji: IP palsu berganti -> 429 setelah 40. Konsekuensi: penyerang dapat mengunci akun maksimal 1 jam (penghitung di memori, reset saat restart).

## Data contoh (2026-11-13)
- ENABLE_DEMO_PAY=1 di .env.docker (atas permintaan; belum deploy sungguhan). Sandi semua akun <sandi-lokal> (belum diganti, tidak online permanen).
- work/seed_docker.mjs mengisi DB Docker via API: akun frontoffice, desain, operator, pelanggan1-3 + 10 pesanan (RPT-1001..1010) di semua tahap. Username minimal 3 karakter, jadi FO = frontoffice. Pesanan hanya diisi bila DB belum punya pesanan.

## Skrip tunnel (2026-11-13)
- scripts/tunnel.mjs (npm run tunnel): nyalakan layanan tunnel, baca alamat dari log, simpan ke pengaturan Alamat situs via API Admin. --new = alamat baru, --stop = matikan. Diuji: tanpa perubahan, --new (2x). Tautan lama yang sudah terkirim tetap rusak bila alamat berganti.

## Backup konfigurasi (2026-11-13)
- backup/2026-11-13-config/ (di luar sites/): dump DB, settings.key + uploads, sesi WAHA, .env.docker, settings-plain.json (rahasia terbaca; hanya uji), PULIHKAN.md. Pengaturan saat itu: WAHA http://waha:3000 sesi default WORKING; SMTP smtp.gmail.com:587 STARTTLS, From 'Printora - Percetakan'. Regenerasi semua rahasia saat deploy sungguhan.

## Kunci enkripsi pengaturan (SETTINGS_KEY)
Penyebab WAHA/email "gagal lagi" setelah build ulang: settings.key dibuat di /data (di luar volume), sehingga kunci baru tiap kontainer dibuat dan rahasia (kunci WAHA, sandi SMTP) tidak terbaca. Perbaikan: SETTINGS_KEY tetap di .env.docker (diteruskan oleh docker-compose.yml). Jangan diganti. Jika terlanjur hilang: node work/restore_settings.mjs (memulihkan dari backup/2026-11-13-config/settings-plain.json).
Jejak kirim: tabel message_log (Pengaturan > pesan terbaru) dan `docker logs printora-app-1` (baris "[pesan] gagal ...").
WAHA: bila status SCAN_QR_CODE, pindai ulang di http://127.0.0.1:3000/dashboard.

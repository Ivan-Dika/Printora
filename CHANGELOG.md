# CHANGELOG Printora

Catatan perubahan, terbaru di bawah per bagian tanggal. Disalin dari catatan kerja proyek; nama jalur seperti `work/` merujuk alat bantu di luar repo ini.

- 2026-11-06 — Initial analysis: created claude/ scaffold, overview doc, recon note.
- 2026-11-06: laporan proyek RPL (docx/pdf) dibangun via work/build_report.py; lihat sessions/2026-11-06-laporan-proyek.md
- 2026-11-06: outputs/Diagram_Revisi/ dibuat (revisi UC/Class/Activity/Sequence); laporan sudah memakai gambar baru
- 2026-11-06: laporan dibangun ulang (43 hlm) memakai outputs/Diagram_Revisi/; Bab 5-7 teks disesuaikan
- 2026-11-06: sequence revisi 3 + audit silang; laporan 44 hlm; D-06 dicatat

## 2026-11-06 — D-06 ditutup (fitur Ketetapan 30 Okt dilengkapi di prototipe)
- sites/rumah-printing-tajinan (BELUM di-commit): lib/domain.ts (attachments/issues/notifications; aksi `issue`, `notify`; `create` menerima berkas), app/operasional/page.tsx (tab Produksi 3, catatan kendala, unggah berkas di Buat Pesanan, catat pemberitahuan), scripts/test-domain.mjs (TC-22..24). tsc bersih, test-domain/api/storefront lulus, build berhasil, UI diperiksa di peramban.
- Diagram: class (berkasPendukung, catatanKendala, pemberitahuan) dan SD-04/05 diperbarui; laporan dibangun ulang (44 hlm).
- Catatan: lint punya error lama (any, ref di storefront), bukan dari perubahan ini. Paket portabel/Netlify belum dibangun ulang.

## 2026-11-06 (malam) — QC end-to-end
- Tambah sites/.../scripts/test-e2e.mjs (70 kasus: 23 positif, 47 negatif, 4 aktor). Hasil 70/70 lulus pada server lokal (percobaan 1: N-45 gagal karena ekspektasi skrip, diperbaiki). Dokumen: outputs/Test_Case_E2E_Rumah_Printing_Tajinan.md. Belum di-commit; belum masuk laporan.

## 2026-11-06 (malam 2) — Test case alur lengkap + dokumentasi UI
- work/e2e_ui.mjs (Chrome headless + CDP): 27 langkah UI lulus, 27 tangkapan layar di work/e2e_shots/. Dokumen: outputs/Test_Case_Alur_Lengkap_Rumah_Printing_Tajinan.docx (dibangun work/build_testcase_doc.py). Kegagalan awal karena skrip (window.status bentrok), bukan aplikasi.

## 2026-11-09 — Rebrand Printora + panduan/alur
- Keputusan koordinator: nama Printora, palet #171717/#FF8500/#FFFFFF, aplikasi percetakan umum (Tajinan hanya studi kasus). Prototipe (belum di-commit): app/globals.css & storefront.css (dibangun ulang oleh work/rebrand_css.py dari cadangan work/backup/css_before_printora/), lib/flow.ts, components/printora.tsx, app/page.tsx, app/operasional/page.tsx, layout.tsx, favicon, README-PROTOTIPE.
- Fitur: menu Panduan per peran, Pipeline 6 fase di Beranda, banner Giliran di detail, tracker + langkah berikutnya untuk pengunjung, FAQ.
- Laporan 45 hlm (CR-04, CR-05, AI-04); diagram/C4 diganti nama tampilan; nama berkas keluaran (Rumah_Printing_Tajinan_*) BELUM diganti; folder sites/rumah-printing-tajinan belum diganti.
- Uji ulang: API 70/70, UI 27/27, test-domain lulus, tsc bersih, build OK. Test case docx dibangun ulang dengan tangkapan layar baru. Belum diuji: situs publik, paket portabel, Netlify.

## 2026-11-09 (sore) — Logo/favicon sebagai aset
- Sites: public/brand/logo-mark.svg, public/brand/favicon.svg (public/favicon.svg dihapus), lib/brand.ts (path aset), PrintoraMark kini <img>, layout.tsx memakai BRAND.favicon. CSS (.store --blue/--dark, img.brandlogo) lewat work/rebrand_css.py. Server `npm start` dijalankan di tab terminal pengguna (c1, port 8787). Belum di-commit.

## 2026-11-09 (malam) — MySQL nyata + unggah 500 MB
- Backend Node (vinext start) + MySQL (Docker herd-mysql), DB printora, 11 tabel; berkas di storage/uploads + tabel files; POST /api/files (aliran, 500 MB), GET /api/files/:id. D1/Cloudflare dilepas dari vite.config.ts. Detail: sessions/2026-11-09-mysql-upload-500mb.md
- Uji: API 81/81 (E2E_BIG=1), UI 27/27, test-domain lulus. Laporan/diagram/test-case docs belum disesuaikan (masih D1, 400 KB). Belum di-commit.

## 2026-11-09 (malam 2) — Dokumen disesuaikan ke MySQL
- Laporan dibangun ulang (45 hlm): FR-04, NFR-03/04, Tabel 7.1, ADR-001, R7, A05/AS-04 + bukti mitigasi, D-03 ditutup, D-07 baru (tanpa autentikasi), baris uji ulang 9 Nov dan DEF-02. Gambar C4 L2 dan design class diperbarui (work/patch_figures_mysql.py, patch_report_mysql.py).
- Test case: outputs/Test_Case_E2E_*.md dibangun ulang oleh work/build_testcase_md.py (81 kasus); docx test case dibangun ulang (menyalin e2e_api_results.json ke e2e_results.json). Tangkapan layar UI = uji 9 Nov pada MySQL.
- Belum diubah: nama berkas keluaran, diagram StarUML/use case (tidak menyebut D1), portabel/Netlify.

## 2026-11-09 (malam 3) — Login, Admin Aplikasi, master data
- Demo dihapus; username+kata sandi (scrypt, sesi cookie); peran Admin Aplikasi + master data (katalog, metode, saluran). Detail: sessions/2026-11-09-login-admin-master-data.md. Uji: e2e 99/99, UI 33/33. Laporan/test-case docs belum diperbarui (D-07 usang). Uncommitted.

## 2026-11-09 (malam 4) — Dokumen disesuaikan ke login/Admin
- Laporan dibangun ulang (46 hlm): FR-13/FR-14, CR-06, AI-05, D-01 ditutup, D-07 diganti sisa batasan, A07 Done, baris uji ulang login (99/99, UI 33/33), gambar C4/design class diperbarui (work/patch_report_auth.py, make_report_figures.py). Test case md (99 kasus) dan docx (33 langkah UI) dibangun ulang. Belum: diagram use case/StarUML (aktor Admin), nama berkas keluaran, portabel/Netlify.

## 2026-11-09 (malam 5) — Tanpa registrasi, UI dirapikan, notifikasi
- Registrasi dihapus (rute /api/auth/register, fungsi register, formulir); akun hanya dibuat Admin. Copy dan tampilan dirapikan (judul polos, tanpa ikon kilau/eyebrow/banner promosi, gradien welcome dihapus). components/notify.tsx: toast bertumpuk + notifikasi desktop (Notification API) + polling 15/20 dtk. Tes: e2e 99/99, UI 35/35. Laporan dan test case dibangun ulang.

## 2026-11-11 — Pembayaran pelanggan, label berwarna, ikon
- Pembayaran pelanggan: Transfer, Tunai (konfirmasi FO), QRIS simulasi (QR -> /bayar/<token>, halaman demo "Pembayaran berhasil"). Tabel payment_requests, lib/pay.ts, rute /api/bayar(+/qr,/demo), components/pay.tsx. QR memakai PUBLIC_URL bila diset; `npm run start:lan` ditambahkan.
- Tampilan: badge status berwarna menurut makna (b0..b7), label kategori (c0..c5), ikon produk (lib/catalog-ui.tsx), hero kartu kategori; ilustrasi bergaya generik dihapus.
- Uji: e2e 116/116, UI 39/39 (port 8788). Belum: laporan (FR-15, CR-07, AI-06) dan test-case docs dibangun ulang; README sudah diperbarui. Uncommitted.

## 2026-11-11 (2) - Etalase bergambar contoh cetak, label prototipe dihapus
- components/printsample.tsx: gambar SVG contoh cetak (banner, stiker, kartu nama, brosur, undangan, kemasan) untuk hero, kartu produk, dan thumbnail pesanan di ruang kerja. Teks Prototipe/simulasi/uji coba dihapus dari etalase, ruang kerja, FAQ, halaman bayar QRIS. Rekening bisa diisi lewat env BANK_NAME/BANK_NUMBER/BANK_HOLDER. Tes: e2e 116/116, UI 39/39. Uncommitted.

## 2026-11-12 - Keputusan QRIS dan akun uji
- Pengguna memutuskan alur QRIS tetap seperti sekarang (QR, pindai langsung sukses, polling otomatis); temuan review keamanan dicatat sebagai risiko yang diterima. Situs diperlakukan sebagai sungguhan.
- Akun uji per peran dibuat (work/make_test_accounts.mjs): fo1, desain1, operator1, pelanggan1; kata sandi di sites/rumah-printing-tajinan/.env.testaccounts (gitignored). Admin: ADMIN_USERNAME/ADMIN_PASSWORD di .env.

## 2026-11-12 (2) - Revisi tampilan: palet biru, logo final, shadcn, loader
- Logo final dipotong dari logo horizontal (public/brand/logo-mark.png, logo-full.png, favicon.png); work/make_logo.py. Palet biru #007BFF + aksen CMYK/hijau/teal, token shadcn di globals.css (CSS lama dibungkus @layer components agar utilitas shadcn menang).
- Tautan silang Ruang Kerja <-> Situs dihapus; border-left diganti kotak lembut; Splash loader (components/splash.tsx) + animasi transisi halaman/dialog; tombol utama memakai shadcn Button.
- Akun uji dibuat ulang setelah db:reset (kata sandi baru di .env.testaccounts). Tes: e2e 116/116, UI 39/39. Uncommitted.

## 2026-11-12 (3) - Perapian lanjutan
- Sisa oranye dibuang (hover, strip contoh, ORANGE di printsample, favicon/logo svg lama, ikon notifikasi); Promosi kini cyan, badge Menunggu verifikasi kuning gelap. Kontras label diperbaiki (teks putih di atas biru; angka lingkaran putih). Form master data/modal, tabel, inlineform dirapikan; chip pengguna di navbar (avatar + nama + peran, lebar maksimum 240px); ikon sukses halaman QRIS di tengah (.okmark).
- Pengujian dilakukan di DB terpisah printora_test (dibuang setelahnya) agar akun pengguna di DB printora tidak tersentuh; kata sandi akun pengguna kini diatur sendiri oleh pengguna. Jangan jalankan npm run db:reset pada DB printora tanpa konfirmasi. e2e 116/116, UI 39/39.

## 2026-11-12 (4) - Perapian 3
- Profil sidebar penuh lebar; kontras label (isi biru solid #0a66e8 + teks putih; .gate, kartu perlu perhatian, sisa warna cokelat dibuang; work/contrast.py memindai rasio kontras). Modal terpusat (animasi tanpa fill forwards agar position:fixed tidak terikat ke elemen beranimasi).
- Pratinjau berkas: components/filepreview.tsx (gambar, PDF via iframe, kartu jenis untuk PSD/AI/EPS/CDR/ZIP/TIFF); thumbnail pesanan memakai desain terakhir bila ada. /api/files PDF inline tanpa sandbox CSP (frame-ancestors self). e2e 116/116, UI 39/39 pada DB printora_test (dibuang).

## 2026-11-12 (5) - Etalase v2: aset visual + responsif mobile
- Aset baru dari pengguna → `public/brand/produk/*.webp` (banner, stiker, kartu-nama, undangan, brosur-modern, brosur-promo) dan `public/brand/bg/*.webp` (hero, layanan, cara).
- `components/printsample.tsx`: `productPhoto`/`ProductPhoto` (foto produk untuk kartu etalase; produk tanpa foto tetap memakai SVG).
- `app/page.tsx`: hero baru (logo + kartu keunggulan), nav dengan menu hamburger di mobile, tautan Beranda; etalase tetap publik (login hanya saat memesan / Pesanan saya).
- `app/storefront.css`: blok "etalase v2" (nav sticky, kartu foto, latar bergambar, breakpoint 900/560).
- Uji: API 116/116, UI 39/39 pada printora_test (sudah dihapus).

## 2026-11-12 (6) - Etalase v3
- Latar menyatu: `work/make_bg.py` membuat `public/brand/bg/etalase.webp` (gradasi lembut, ujung atas/bawah sama, `repeat-y` di `.store`); latar per-seksi lama dihapus.
- Kartu layanan diperkecil (auto-fill min 230px, gambar 500/380, 2 kolom di ponsel); "Cara memesan" 2 kolom di tablet.
- Uji API 116/116, UI 39/39 (printora_test dihapus).

## 2026-11-12 (7) - Etalase v4
- Cara memesan: daftar bernomor + ikon + pil peran, ilustrasi dipotong dari template (`public/brand/bg/cara-ilustrasi-v2.webp`, tepi dilunakkan); FAQ selebar penuh; footer ala template (logo, tautan, tagline + garis warna).
- Latar `etalase-v2.webp` dibuat ulang (`work/make_bg.py`): gradasi berwarna, batang diagonal, titik halftone, pita CMYK; bug "kotor" akibat blur RGBA diperbaiki; `background-size:max(100%,1600px)`.
- Uji API 116/116, UI 39/39 (printora_test dihapus).

## 2026-11-12 (8) - Fase 1: pesan tanpa login + akun otomatis
- Alur: etalase publik → form (nama, telepon/email, tipe pesanan=produk katalog, spesifikasi, jumlah, opsi desain-dulu/langsung-cetak, berkas) → `POST /api/pesan` membuat akun Pelanggan (username `namaXXXX`, sandi acak 10 karakter, `must_change=1`), pesanan, dan sesi; berkas diunggah lalu dilampirkan lewat `/api/pengunjung` `attach`; kredensial tampil sekali; tombol ke `/operasional`.
- Keamanan: telepon/email yang sudah terdaftar → 409 (tidak menumpang ke akun orang); batas laju per IP (6/jam), per identitas (3/jam), global (300/jam); kolom jebakan bot; sameOrigin; aksi `/api/state` diblokir (403) selama `must_change` sampai sandi diganti (`/api/auth`, `/api/files`, `/api/pengunjung` dikecualikan).
- Skema: `users.email`, `users.must_change`, `orders.mode` (migrasi otomatis). Domain: `Order.mode`, aksi `attach`; produksi langsung-cetak cukup dengan berkas pelanggan + DP.
- Login dari etalase / "Pesanan saya" → redirect `/operasional`; panel riwayat di etalase dihapus. Ruang Kerja: dialog wajib ganti sandi, baris "Opsi" di ringkasan, pilihan opsi di form Buat Pesanan.
- Belum (Fase 2/3): WhatsApp (WAHA), email SMTP, pengaturan Admin, notifikasi per status. Kredensial saat ini hanya tampil di layar sukses.
- Uji: API 135/135, UI 45/45 (printora_test dihapus).

## 2026-11-12 (9) - Fase 2: WhatsApp (WAHA) + email (SMTP) + Pengaturan Admin
- `lib/settings.mjs` (tabel `settings`; API key WAHA dan sandi SMTP terenkripsi AES-256-GCM, kunci dari `SETTINGS_KEY` atau `storage/settings.key`), `lib/messaging.mjs` (WAHA `POST /api/sendText` dengan `X-Api-Key`; SMTP via nodemailer; tabel `message_log` tanpa isi pesan/sandi), dependensi baru `nodemailer`.
- Admin: menu **Pengaturan** (aktifkan WAHA/SMTP, alamat, sesi, kunci, pengirim, alamat publik, tombol uji kirim, riwayat 15 pengiriman). Rahasia tidak pernah dikembalikan ke browser; kosong = tidak mengubah.
- `POST /api/pesan` mengirim info pesanan + akses masuk di latar belakang (kegagalan hanya dicatat; pesanan tetap tersimpan); respons memuat `sentTo`; layar sukses menyebut saluran yang dipakai.
- Uji: API 149/149 (server WAHA dan SMTP tiruan di test), UI 46/46, domain; printora_test dihapus.
- Belum (Fase 3): notifikasi tiap perubahan status, dokumentasi/laporan, README.

(10) Perbaikan keamanan (temuan tinjauan otomatis): tautan Ruang Kerja pada pesan kredensial (`app/api/pesan/route.ts`) tidak lagi diturunkan dari header Host/URL permintaan (risiko link-poisoning). Hanya memakai `public_url` (Admin) atau `PUBLIC_URL`; bila kosong, pesan tanpa tautan (`orderCreatedText` di `lib/messaging.mjs`). Uji baru N-117 (Host/X-Forwarded-Host palsu); API 150/150 lulus, domain PASS. Belum di-commit.

(11) Fase 3 - notifikasi tiap status: `write()` di `lib/api.ts` kini membandingkan state sebelum/sesudah commit dan memanggil `notifyStatusChanges` (`lib/messaging.mjs`, fungsi murni `statusNotices`). Pelanggan diberi tahu via WhatsApp/email saat: verifikasi, desain baru siap ditinjau, pembayaran (sisa/lunas), antrean produksi, mulai produksi, perbaikan, siap diambil, selesai. Aksi pelanggan sendiri dan pesanan baru tidak memicu pesan; kata sandi tidak pernah disertakan; tautan hanya dari public_url. Tes: API 151/151, UI 46/46, domain PASS (+ blok statusNotices). Belum di-commit.

(12) Ruang Kerja v3 (UI): blok CSS "Ruang Kerja v3" di `app/globals.css` (kertas biru + semburat CMYK, sidebar dengan ikon berwarna, topbar kaca, judul berunderline CMYK, kartu/tabel/tab membulat, pipeline dan statistik berwarna, panduan, dialog). Karakter khusus diganti: titik tengah dan bullet di JSX menjadi komponen `<Sep/>` (`components/printsample.tsx`), tanda centang menjadi ikon `Check`, panah `->` di panduan menjadi rantai ikon `ChevronRight` (`components/printora.tsx`, dengan ikon Lock/Flag untuk syarat/status), tanda "›" pipeline menjadi ikon SVG, tanda "—" menjadi teks "Tanpa telepon". Kutip «» pada teks FAQ dipertahankan. Tes: API 151/151, UI 46/46, domain PASS. Catatan deploy Docker: `claude/notes/deploy-docker.md` (build belum selesai). Belum di-commit.

(13) Flow RPT-1002 + Panduan: data RPT-1002 (DB asli) konsisten, bukan korup: status Desain, terverifikasi, DP 50.000 belum dibayar, desain v1 disetujui pelanggan tetapi belum ditetapkan final oleh Tim Desain (menunggu langkah itu + DP + Teruskan ke produksi). Celah UX yang diperbaiki: kotak «Giliran» (`turn()` di `lib/flow.ts`) kini memberi catatan DP (kurang berapa, pelanggan bayar di tab Pembayaran, FO konfirmasi) dan menangani mode Langsung cetak; `visitorNext` menyebut DP segera setelah desain disetujui. Panduan (`STEPS`, nomor otomatis) ditambah langkah Pelanggan "Bayar DP"/"Lunasi sisa tagihan" dan FO "Konfirmasi atau catat DP/pelunasan"; FAQ diperbarui (notifikasi otomatis, akun pelanggan otomatis, kenapa tetap «Desain», kapan boleh bayar DP); teks usang (maks. 400 KB, "sistem tidak mengirim pesan", "bingkai oranye") dihapus. Tes API 151, UI 46, domain PASS. Belum di-commit.

(14) Pusat notifikasi + perbaikan tombol pelanggan: lonceng kini membuka riwayat notifikasi (`NotifyCenter`, `buildNotes` di `components/notify.tsx`): dibangun dari riwayat aktivitas pesanan di server (aksi sendiri dikecualikan), badge belum dibaca (status baca di localStorage), klik item membuka pesanan di tab terkait, plus pengingat "Bayar DP/Lunasi" untuk pelanggan dan tombol izin notifikasi desktop. Ringkasan pesanan pelanggan pada status Desain: setelah desain disetujui tombol menjadi "Bayar DP Rp X" (ke tab Pembayaran) + "Lihat desain", bukan "Tinjau desain". Kutip sudut dihapus dari UI (lib/flow.ts memakai tanda kutip biasa). Teks riwayat 'ready' tidak lagi menyebut pelanggan dihubungi manual. Tes: API 151, UI 46, domain PASS. Belum di-commit.

(15) Label tahap yang jelas: status internal "Desain" tidak lagi ditampilkan mentah. `stageInfo()`/`inDpStage()` di `lib/flow.ts` menurunkan label dari keadaan pesanan: Desain sedang dibuat, Menunggu persetujuan desain, Revisi desain, Menunggu pembayaran DP (tone kuning), Menyiapkan berkas final, Siap diteruskan ke produksi, Siap diambil belum lunas. Dipakai pada Badge (tabel, kepala pesanan, tab Produksi). Stepper pesanan kini 6 tahap (ditambah "Pembayaran DP"), alur Beranda/Panduan 7 fase (fase "Pembayaran DP" dengan `PHASES[].test`). Kotak Giliran bagi pelanggan menonjolkan "Bayar DP Rp X" (`turn(o, role)`). Status di database tidak berubah. Tes: API 151, UI 46, domain PASS. Belum di-commit.

(16) Docker deploy dicoba ulang dan berhasil untuk app+db (lihat claude/notes/deploy-docker.md). Perbaikan: Dockerfile tanpa npm prune dan CMD memakai vinext lokal; QRIS simulasi diberi saklar `ENABLE_DEMO_PAY` (temuan keamanan payment bypass): bila 0, `/api/bayar/demo` POST 403, halaman /bayar tanpa tombol bayar, FO dapat mengonfirmasi QRIS (`lib/pay.ts`, `components/pay.tsx`, `app/bayar/[id]/page.tsx`); compose default 0. Tes E2E mendukung `MOCK_HOST`. Terhadap kontainer: API 151/151, UI 46/46. Belum di-commit.

(17) Stack Docker dijalankan untuk user (nama proyek compose `printora`; kontainer printora-db-1, printora-app-1, printora-waha-1). `.env.docker` berisi sandi acak (tidak di-commit, di folder sites/rumah-printing-tajinan). Compose diberi `name: printora`.

(18) Temuan keamanan 2: `demoPayEnabled` (lib/pay.ts) kini fail-closed: QRIS simulasi hanya menyala bila ENABLE_DEMO_PAY=1 eksplisit (sebelumnya menyala kecuali =0). `.env` lokal diberi ENABLE_DEMO_PAY=1 agar demo lokal tetap jalan; compose default 0. API 151/151 dengan flag=1; tanpa flag endpoint demo 403.

(19) Atas permintaan user, semua sandi stack Docker lokal diseragamkan menjadi <sandi-lokal> (admin aplikasi via API ganti sandi, MySQL root dan printora_app via ALTER USER, WAHA via .env.docker + recreate). Hanya untuk lokal 127.0.0.1; WAJIB diganti sebelum online. Pengaturan WAHA di aplikasi belum diisi.

2026-11-13: Login/Ruang Kerja/kwitansi/logo; SETTINGS_KEY tetap; WAHA NOWEB + cek ack; retry SMTP; logo inline email; uji alur live A/B. Uncommitted.

## 2026-11-16 - Perapian repositori
- Repositori dimulai ulang tanpa riwayat commit lama (belum ada commit). Dihapus: sisa template (chatgpt-auth, worker, examples, db/drizzle, vendor, skrip install/preview, komponen UI shadcn yang tidak dipakai, hooks), skrip uji lama (test-api, test-storefront), dan dependensi yang tidak dipakai. Cek tipe bersih, build berhasil, test-domain lulus.
- Folder `docs/` ditata ulang per jenis (laporan, diagram, pengujian, panduan, presentasi, tampilan), nama berkas disederhanakan (huruf kecil, tanda hubung), dan ditambah `docs/README.md` sebagai indeks.

## 2026-11-16 - Lisensi
- Ditambah `LICENSE` (MIT, Vandikara dan Andika Setiawan; lisensi awal dari commit "Initial commit" di GitHub) dan `THIRD_PARTY_LICENSES.md` (shadcn/ui, sumber `components/ui/button.tsx`).

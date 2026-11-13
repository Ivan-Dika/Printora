# AI_USAGE — Penggunaan AI pada Proyek Printora (studi kasus Rumah Printing Tajinan)

Dokumen ini menyatakan secara terbuka bagian proyek yang dikerjakan dengan bantuan AI. Pernyataan lingkup berasal dari koordinator (Ivan Dika Pratama): seluruh isi proyek dikerjakan dengan bantuan **ChatGPT**, kecuali perubahan yang tercatat pada bagian Claude di bawah.

Pengambilan keputusan, pemberian informasi domain, dan tanggung jawab akhir tetap pada anggota kelompok:

| Pihak | Peran |
|---|---|
| Ivan Dika Pratama (252011082) | Koordinator; menetapkan keputusan proyek dan menyetujui hasil |
| Andika Setiawan (252011001) | Analis sistem dan sumber informasi alur kerja percetakan |
| ChatGPT | Asisten AI (OpenAI) |
| Claude | Asisten AI (Anthropic), model Claude Sonnet 5.5 melalui Claude Code |

## 1. ChatGPT

Cakupan: seluruh isi proyek sebelum sesi Claude, yaitu:

- Penyusunan struktur dan isi **Laporan Awal** (tanggal dokumen 23 Okt 2026) dan struktur diagram awal (23 Okt 2026).
- **Prototipe** aplikasi web (pembuatan awal 16 Okt 2026 menurut keterangan koordinator): V1 ruang operasional, V2 etalase layanan cetak dan ruang staf, paket portabel Windows, serta kode sumber di `sites/rumah-printing-tajinan` (tiga commit tertanggal 2 Nov 2026).
- Berkas diagram awal (StarUML `.mdj` dan gambar): use case, class, activity, sequence, serta diagram arsitektur.
- Dokumen pendukung di `outputs/`, antara lain Aktor dan Menu Sistem serta Ringkasan Progres.

Rincian per berkas ChatGPT tidak diaudit ulang oleh Claude; pernyataan di atas mengikuti keterangan koordinator.

## 2. Claude

Cakupan: pekerjaan pada sesi 6 Nov 2026, dijalankan atas instruksi koordinator.

### 2.1 Laporan proyek
- Menyusun **Laporan Proyek RPL — Rumah Printing Tajinan** (`outputs/Laporan_Proyek_RPL_Rumah_Printing_Tajinan.docx` dan `.pdf`, 44 halaman) mengikuti format dan desain laporan referensi SIMAKA Lite, dengan isi sendiri bersumber dari Laporan Awal dan artefak proyek.
- Skrip pembangun laporan: `work/build_report.py` dan `work/build_report_lib.py`.
- Aturan yang diikuti: tidak ada rapat, wawancara, uji, tanggal, atau capaian karangan; metodologi ditulis sebagai Waterfall yang disesuaikan dengan prototipe; hal yang belum pasti ditandai «Perlu dikonfirmasi».

### 2.2 Peninjauan dan revisi diagram
- Meninjau diagram yang ada, lalu membuat versi revisi pada `outputs/Diagram_Revisi/` (berkas asli tidak ditimpa; cadangan di `work/backup/`):
  - Use case: penomoran UC-01 sampai UC-13, relasi include, penempatan aktor.
  - Class diagram: enumerasi, komposisi, atribut turunan.
  - Activity diagram: perbaikan alur dan pengulangan.
  - Sequence diagram 01–05: aktor sebagai stick figure, balok aktivasi, fragmen `alt`.
- Generator diagram: `work/revisi/*.py` (ReportLab dan JSON StarUML).
- **Keterbatasan:** berkas `.mdj` hasil revisi baru divalidasi struktur ID dan referensinya; belum dibuka di aplikasi StarUML.

### 2.3 Verifikasi silang
- Memeriksa kesesuaian keputusan, diagram, kode prototipe, dan uji (Tabel 5.2 laporan). Delapan aturan inti selaras; tiga fitur Ketetapan 30 Okt 2026 belum ada pada prototipe (kemudian ditambahkan, lihat 2.4).

### 2.4 Perubahan kode prototipe (6 Nov 2026)
Berkas: `lib/domain.ts`, `app/operasional/page.tsx`, `scripts/test-domain.mjs` di `sites/rumah-printing-tajinan`.
- Unggah berkas pendukung oleh pelanggan pada Buat Pesanan.
- Tiga tab Produksi (Antrean, Sedang Dikerjakan, Selesai Produksi) dan pencatatan kendala oleh Operator.
- Pencatatan pemberitahuan ke pelanggan pada Penyerahan (tanpa pengiriman otomatis).
- Kasus uji baru TC-22 sampai TC-24.
- **Status:** belum di-commit, belum dibangun ulang pada paket portabel, dan belum di-deploy ke situs publik.

### 2.5 Merek, gaya, dan panduan alur prototipe (9 Nov 2026)
- Nama aplikasi **Printora** dan palet hitam #171717, oranye #FF8500, putih #FFFFFF ditetapkan oleh koordinator; Claude menerapkannya pada `app/globals.css`, `app/storefront.css`, logo, dan favicon.
- Menu **Panduan** per peran, alur enam fase dengan jumlah pesanan, banner «Giliran» pada detail pesanan, dan pelacak tahap untuk pengunjung (`lib/flow.ts`, `components/printora.tsx`).
- Nama pada laporan dan diagram diganti menjadi Printora; Rumah Printing Tajinan tetap disebut sebagai studi kasus. Nama berkas keluaran belum diubah.
- Uji ulang: API 70/70 dan UI 27/27 lulus. Belum di-commit.

### 2.6 Backend MySQL dan unggah 500 MB (9 Nov 2026)
- Atas permintaan koordinator: data statis/D1 diganti **server Node + MySQL** (Docker lokal `herd-mysql`), skema ternormalisasi, transaksi dengan nomor revisi, dan unggah berkas aliran hingga **500 MB** (disimpan di disk, metadata di tabel `files`). Berkas utama: `lib/mysql.mjs`, `lib/api.ts`, `lib/files.ts`, `lib/upload.ts`, `app/api/files/**`, `scripts/db.mjs`.
- Basis data `printora` dan pengguna `printora_app` dibuat Claude melalui akun root kontainer milik koordinator; kata sandi acak hanya di `.env` (tidak di-commit).
- Uji: API 81/81 (termasuk batas 500 MB), UI 27/27. Laporan proyek (45 hlm), gambar arsitektur, dan dokumen test case kemudian disesuaikan dengan MySQL dan batas 500 MB (pada hari yang sama, atas persetujuan koordinator). Belum di-commit.

### 2.7 Login, Admin Aplikasi, dan master data (9 Nov 2026)
- Atas permintaan koordinator: mode demo dihapus; semua pengguna masuk dengan username/kata sandi; peran baru Admin Aplikasi mengelola pengguna dan master data (katalog, metode pembayaran, saluran). Claude menulis `lib/password.mjs`, `lib/auth.mjs`, `lib/master.mjs`, rute `/api/auth/*`, `/api/admin`, `/api/katalog`, komponen `components/auth.tsx` dan `admin.tsx`, serta menulis ulang tes (`scripts/test-lib.mjs`, `test-e2e.mjs` kini 99 kasus, UI 33 langkah).
- Kata sandi Admin awal dibuat acak oleh Claude dan hanya ada di `.env` (tidak di-commit, tidak ditampilkan). Tinjauan keamanan otomatis menandai akses berkas berbasis id (IDOR); diperbaiki dengan pemeriksaan pengunggah/peran/pihak pesanan.
- Atas persetujuan koordinator, laporan (46 hlm; FR-13/14, CR-06, AI-05, D-01 ditutup, D-07 diganti) dan dokumen test case dibangun ulang. Diagram use case belum menggambar aktor Admin. Belum di-commit.

### 2.8 Tanpa registrasi, perapian UI, notifikasi (9 Nov 2026)
- Atas permintaan koordinator: pendaftaran mandiri dihapus (akun hanya dibuat Admin), teks dan tampilan antarmuka disederhanakan (mengurangi gaya promosi/generik), dan ditambah toast di halaman serta notifikasi desktop lewat Notification API peramban (muncul di pusat notifikasi Windows bila izin diberikan dan jendela tidak sedang aktif). Uji: API 99/99, UI 35/35. Belum di-commit.

### 2.9 Catatan kerja
- Folder `claude/` (state, changelog, catatan, entri sesi) dan `CLAUDE.md` berisi memori kerja proyek; bersifat privat dan tidak di-commit.

## 3. Verifikasi yang dilakukan

| Pemeriksaan | Hasil |
|---|---|
| `test-domain.mjs` (termasuk TC-22..24) | Lulus |
| `test-api.mjs`, `test-storefront.mjs` pada server lokal | Lulus |
| `tsc --noEmit`, `npm run build` | Berhasil |
| Pemeriksaan tampilan fitur baru di peramban (server lokal) | Sesuai |
| `npm run lint` | Gagal; ada error yang sudah ada (tipe `any`, akses ref pada `app/page.tsx`), dan satu `any` baru dari perubahan Claude |
| Berkas `.mdj` di StarUML | Belum diuji |
| Pembukaan DOCX di Microsoft Word | Belum diuji; paginasi diukur dengan LibreOffice dan dapat berbeda |
| Uji pada paket portabel dan situs publik setelah perubahan | Belum dilakukan |

## 4. Tanggung jawab dan peninjauan

- Hasil AI telah atau perlu ditinjau oleh anggota kelompok sebelum dikumpulkan; AI tidak menggantikan tanggung jawab penulis.
- Nomor penugasan/pertemuan pada laporan dan URL deployment akhir diisi sendiri oleh koordinator.
- Data pada prototipe adalah data contoh untuk demonstrasi, bukan transaksi nyata.

## 5. Pembaruan 11 sampai 13 Nov 2026 (Claude, atas instruksi koordinator)

Bagian ini melengkapi 2.1 sampai 2.9. Rincian per tanggal ada di `CHANGELOG.md`.

- **Merek dan tampilan:** palet diubah menjadi biru #007BFF dengan aksen CMYK (menggantikan hitam/oranye pada 2.5); logo dan ikon dari aset yang diberikan koordinator; etalase baru dengan foto produk dan latar, tampilan responsif, layar masuk dua kolom, Ruang Kerja dengan gaya ambient, pemilih (select) bergaya, dan pemuat awal.
- **Alur pesanan tanpa login:** pelanggan memesan dari etalase; akun Pelanggan dibuat otomatis dengan kata sandi sementara yang wajib diganti; pilihan *Desain dulu* atau *Langsung cetak*; pembatasan laju dan penolakan telepon/email yang sudah terdaftar.
- **Pembayaran dan kwitansi:** pembayaran Transfer, Tunai, dan QRIS simulasi dari halaman pelanggan; kwitansi bernomor dengan cap LUNAS yang dapat dicetak.
- **Notifikasi:** WhatsApp lewat WAHA (mesin NOWEB, status terkirim diperiksa) dan email lewat SMTP (nodemailer, HTML dengan logo inline, satu kali ulang saat timeout); pesan terformat per peran di tiap perubahan status; pengaturan terenkripsi (AES-256-GCM) dan riwayat pengiriman di tabel `message_log`. Kendala WhatsApp: penerima yang belum pernah berkirim pesan ke nomor pengirim dapat ditolak (galat 463).
- **Deploy:** Docker Compose (aplikasi, MySQL, WAHA, Cloudflare Tunnel), `SETTINGS_KEY` tetap agar rahasia tidak hilang saat kontainer dibangun ulang.
- **Keamanan:** tautan Ruang Kerja pada pesan tidak lagi diturunkan dari header Host; QRIS simulasi gagal-tertutup (hanya menyala bila `ENABLE_DEMO_PAY=1`); akses berkas diperiksa per peran.
- **Pengujian:** domain lulus, API 154/154, UI 47/47 pada basis data uji terpisah; alur lengkap *Desain dulu* dan *Langsung cetak* dijalankan nyata dengan WhatsApp dan email. Pemeriksaan kotak masuk yopmail dan pembukaan DOCX/StarUML oleh manusia belum dilakukan.
- **Presentasi:** slide `docs/presentasi/printora.pptx` (5 slide) dan rekaman alur UI `docs/tampilan/rekaman-alur-ui.gif`.
- **Pembaruan dokumentasi:** `README.md` dan `CHANGELOG.md` disusun saat repositori dibersihkan. Laporan dan test case di `docs/` belum disesuaikan dengan perubahan 11 sampai 13 Nov (mis. `docs/panduan/prototipe.md` masih menyebut palet lama).
- **Catatan:** semua kata sandi dan kunci pada pengembangan bersifat lokal dan tidak ada di repositori; ganti sebelum dipakai sungguhan.

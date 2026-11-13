# Printora — prototipe sistem pesanan percetakan (RPL)

Lima peran: **Admin Aplikasi**, Front Office, Pelanggan, Tim Desain, dan Operator. Tidak ada lagi mode demo: setiap pengguna **masuk dengan username dan kata sandi**. Tidak ada pendaftaran mandiri: semua akun (termasuk pelanggan) dibuat oleh Admin Aplikasi.

## Akun dan master data

- Saat database kosong dibuat satu akun Admin (username dari `ADMIN_USERNAME`, bawaan `admin`; kata sandi dari `ADMIN_PASSWORD` di `.env`, atau acak dan ditulis ke `storage/admin-initial-password.txt`). Ganti kata sandi setelah masuk pertama kali.
- Kata sandi disimpan sebagai hash scrypt. Sesi memakai cookie HttpOnly acak 12 jam; yang disimpan di database hanya hash SHA-256 tokennya. Percobaan masuk dibatasi (8 per 10 menit per akun dan IP, di memori proses).
- **Admin Aplikasi** mengelola: pengguna (buat, ubah peran/status, atur ulang kata sandi), katalog layanan etalase, metode pembayaran, dan saluran pemberitahuan. Admin dapat melihat semua pesanan tetapi tidak menjalankan tahap pesanan. Pengaman: tidak dapat menonaktifkan/mengubah peran diri sendiri, minimal satu Admin aktif, peran pengguna yang sudah terkait pesanan tidak dapat diubah, minimal satu metode dan satu saluran aktif.
- `npm run db:reset` mengosongkan seluruh data lalu membuat ulang Admin dan master data awal (5 produk, Tunai/Transfer/QRIS, Telepon/WhatsApp/Tatap muka).

## Penyimpanan

Data disimpan di **MySQL** (basis data `printora`, InnoDB, utf8mb4) dengan skema ternormalisasi: `users`, `orders`, `designs`, `payments`, `attachments`, `revisions`, `issues`, `notifications`, `history`, `files`, dan `meta` (nomor revisi). Data dipakai bersama oleh semua pengguna (bukan lagi satu dokumen JSON per pemilik). Setiap perubahan berjalan dalam satu transaksi yang mengunci baris `meta`; nomor revisi yang usang ditolak dengan HTTP 409. Tiap peramban pengunjung di etalase memiliki akun pelanggan sendiri (dari sesi `X-Rpt-Demo`).

**Berkas** (hingga **500 MB** per unggahan) tidak lagi disisipkan ke JSON. Peramban mengirim isi berkas mentah ke `POST /api/files` (aliran, dengan indikator kemajuan); server menulisnya bertahap ke `storage/uploads/` dan mencatat metadatanya di tabel `files`. Aksi pesanan hanya membawa id berkas, yang diverifikasi saat disimpan (ada, milik pengunggah, belum terpasang). Jenis yang diterima: PNG, JPG, WebP, PDF, TIFF, ZIP, PSD, AI, EPS, CDR; isi diperiksa terhadap penanda awal berkas. Unduh lewat `GET /api/files/:id` (hanya PNG/JPG/WebP/PDF yang tampil inline; lainnya selalu diunduh, dengan `nosniff`). Berkas yang tidak pernah dipasang pada pesanan dibersihkan setelah 24 jam.

## Menjalankan (Windows, Node ≥ 22.13, Docker)

1. MySQL: kontainer Docker `herd-mysql` (mysql:8.4, port 3306) harus berjalan.
2. Salin `.env.example` menjadi `.env` lalu isi kata sandi pengguna `printora_app` (basis data dan pengguna dibuat sekali dengan akun root kontainer: lihat bagian di bawah). `.env` tidak masuk git.
3. `npm install`, lalu `npm run build`.
4. `npm run db:migrate` (opsional; skema dibuat otomatis saat server pertama kali menerima permintaan, beserta data contoh).
5. `npm start` → http://127.0.0.1:8787 (etalase `/`, ruang staf `/operasional`). Mode pengembangan: `npm run dev` (port 5173).

Perintah basis data: `npm run db:status` (jumlah baris), `npm run db:reset` (kosongkan semua tabel dan berkas, muat ulang data contoh).

Membuat basis data dan pengguna (sekali, ganti `KATA_SANDI`):

```sql
CREATE DATABASE printora CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'printora_app'@'%' IDENTIFIED BY 'KATA_SANDI';
GRANT ALL PRIVILEGES ON printora.* TO 'printora_app'@'%';
```

## Pengujian

- Aturan bisnis: `node --experimental-strip-types scripts/test-domain.mjs`
- Terhadap server yang berjalan: `node scripts/test-api.mjs http://127.0.0.1:8787`, `node scripts/test-storefront.mjs ...`, `node scripts/test-e2e.mjs ...` (81 kasus bila `E2E_BIG=1`, termasuk batas 500 MB; tanpa itu 79 kasus). Jalankan `npm run db:reset` sebelum uji agar data awal konsisten.
- UI (Chrome headless): `node ../../work/e2e_ui.mjs http://127.0.0.1:8787` dari folder ini.

## Alur uji

Pelanggan membuat pesanan → FO menetapkan biaya, DP, tenggat, petugas → Tim Desain mengunggah rancangan → pelanggan meminta revisi atau menyetujui → Tim Desain menetapkan final → FO mencatat DP dan meneruskan produksi → Operator mulai dan memeriksa hasil → FO menandai siap diambil → FO mencatat pelunasan → FO mencatat penerima dan penyerahan.

Pembayaran bukan gateway transaksi. Pemberitahuan kepada pelanggan dilakukan manual. Belum mencakup pembatalan, pengembalian dana, stok bahan, atau login staf sungguhan. Antarmuka dan alur ditujukan untuk demonstrasi tugas kuliah, bukan penggunaan produksi langsung. Karena belum ada autentikasi, siapa pun yang mengetahui id berkas (UUID acak) dapat mengunduhnya.

## Versi 2 — situs layanan cetak
Halaman awal menampilkan katalog dan cara pemesanan. Pilih produk, isi kontak dan spesifikasi, lalu simpan nomor pesanan. Menu Pesanan saya menampilkan pesanan dari profil pengunjung. Pelanggan dapat meninjau berkas, meminta revisi, atau menyetujui desain. Pesanan masuk ke antrean FO pada /operasional.

## Catatan migrasi (9 Nov 2026)
Sebelumnya prototipe memakai Cloudflare Workers + D1 (JSON per pemilik, berkas base64 ≤ 400 KB). Sekarang server Node (vinext) + MySQL. Konfigurasi Cloudflare/D1 dilepas dari `vite.config.ts`; penyebaran ke Cloudflare atau Netlify tidak lagi berlaku tanpa MySQL dan server Node yang dihosting.

## Notifikasi

Toast di halaman muncul saat ada perubahan pesanan dari pengguna lain (polling tiap 15 detik di ruang kerja, 20 detik di etalase). Tombol lonceng di bilah atas meminta izin notifikasi desktop; bila diizinkan dan jendela tidak sedang aktif, pembaruan muncul sebagai notifikasi sistem (pusat notifikasi Windows). Pastikan notifikasi peramban tidak dimatikan di pengaturan Windows.

## Pembayaran pelanggan

Setelah FO memverifikasi pesanan, pelanggan membayar dari halaman **Pesanan saya** (panel "Bayar tagihan"): pilih nominal (DP atau lunas) dan metode.

| Metode | Alur |
|---|---|
| Transfer | Rincian rekening ditampilkan (data contoh). FO mengonfirmasi di tab Pembayaran pesanan setelah dana diterima. |
| Tunai | Pelanggan membayar di kasir. FO mengonfirmasi setelah uang diterima. |
| QRIS (simulasi) | Kode QR ditampilkan. Bila dipindai, ponsel membuka `/bayar/<token>`, halaman uji yang menampilkan "Pembayaran berhasil" setelah tombol **Bayar sekarang** ditekan. Tidak ada uang yang dipindahkan. Status pesanan diperbarui otomatis. |

Agar QR dapat dipindai dari ponsel, jalankan server di jaringan lokal dan set alamat publiknya:

```
npm run start:lan
set PUBLIC_URL=http://<IP-komputer>:8787
```

Tanpa `PUBLIC_URL`, QR berisi alamat yang dipakai pelanggan membuka situs (mis. `127.0.0.1`), sehingga hanya terbuka di komputer itu.

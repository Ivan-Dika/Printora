# Test Case dan Hasil QC End-to-End — Printora

Tanggal pengujian: 9 Nov 2026 (uji ulang pada backend MySQL dengan login dan Admin Aplikasi; versi sebelumnya 6 Nov 2026 pada D1 tanpa login). Penguji: Claude (dijalankan atas instruksi koordinator). Skrip: `sites/printora/scripts/test-e2e.mjs`.

## 1. Lingkup dan lingkungan
- Objek: prototipe pada pohon kerja lokal (belum di-commit), dibangun dengan `npm run build` dan dijalankan dengan `npm start` (server Node/vinext, MySQL 8.4 di Docker, basis data `printora`, berkas di `storage/uploads`) di `http://127.0.0.1:8787`.
- Satu pesanan diproses dari pengajuan sampai penyerahan oleh empat aktor: Pelanggan (c1), Front Office (fo), Tim Desain (design), Operator (operator); pelanggan lain (c2) dan Admin Aplikasi dipakai untuk uji akses dan master data. Setiap jalan membuat akun uji lewat Admin (`scripts/test-lib.mjs`) dan masuk dengan cookie sesi.
- Data bersama pada satu basis data; jalankan `npm run db:reset` sebelum uji agar kondisi awal bersih (hanya Admin dan master data awal; kata sandi Admin dari `ADMIN_PASSWORD` di `.env`).
- **Bukan** cakupan: situs publik, paket portabel Windows, uji beban, dan uji keamanan mendalam. Autentikasi diuji pada N-56..N-70 dan P-29..P-31; batasan yang tersisa tercatat pada D-07 di laporan.

## 2. Metode
- Uji dilakukan pada lapisan API (`POST /api/state`, `POST /api/files`, `GET /api/files/:id`) yang menjalankan aturan domain yang sama dengan antarmuka. Kasus positif (P) harus berhasil (HTTP 200/201); kasus negatif (N) harus ditolak (HTTP 400/403/404/409/413/415) dengan pesan yang sesuai.
- Berkas diunggah dahulu lewat `/api/files`; aksi pesanan hanya membawa id berkas. Kasus batas 500 MB (P-26, N-55) dijalankan dengan `E2E_BIG=1`.
- Antarmuka diuji terpisah (35 langkah termasuk layar masuk, Admin, dan toast, Chrome headless; lihat dokumen Test_Case_Alur_Lengkap).

## 3. Ringkasan hasil
| Ukuran | Jumlah |
|---|---|
| Total kasus | 99 |
| Positif | 30 (lulus 30) |
| Negatif | 69 (lulus 69) |
| Gagal | 0 |

Catatan proses: pada percobaan pertama N-48 (pemakaian ulang berkas) gagal karena celah nyata pada pemeriksaan klaim berkas (berkas yang sudah terpasang dapat dirujuk lagi oleh rancangan/lampiran baru); diperbaiki pada `claimFiles` lalu semua kasus lulus. Server juga sempat berhenti ketika unggahan melebihi batas (galat aliran tulis tanpa pendengar); diperbaiki sebelum uji ulang.

## 4. Alur positif (jalur normal) — urut dari awal sampai akhir
| ID | Aktor | Skenario | Hasil yang diharapkan | Hasil |
|---|---|---|---|---|
| P-01 | Pelanggan | Mengajukan pesanan dengan berkas pendukung | Berhasil (HTTP 200) | Lulus |
| P-02 | Pelanggan | Berkas pendukung tersimpan pada pesanan | Ada 1 berkas | Lulus |
| P-03 | Front Office | Verifikasi: total 100.000, DP 40.000, tenggat, petugas | Berhasil (HTTP 200) | Lulus |
| P-04 | Tim Desain/Operator | Tim Desain dan Operator kini melihat pesanan yang ditugaskan | Terlihat | Lulus |
| P-05 | Tim Desain | Mengunggah desain versi 1 | Berhasil (HTTP 200) | Lulus |
| P-06 | Pelanggan | Meminta revisi desain | Berhasil (HTTP 200) | Lulus |
| P-07 | Tim Desain | Mengunggah desain versi 2 (revisi) | Berhasil (HTTP 200) | Lulus |
| P-08 | Pelanggan | Menyetujui desain versi 2 | Berhasil (HTTP 200) | Lulus |
| P-09 | Tim Desain | Menetapkan berkas final | Berhasil (HTTP 200) | Lulus |
| P-10 | Front Office | Mencatat DP sebagian 20.000 | Berhasil (HTTP 200) | Lulus |
| P-11 | Front Office | Melengkapi DP 20.000 (total DP 40.000) | Berhasil (HTTP 200) | Lulus |
| P-12 | Front Office | Meneruskan pesanan ke produksi (DP terpenuhi, desain final) | Berhasil (HTTP 200) | Lulus |
| P-13 | Operator | Mencatat kendala saat berada di antrean | Berhasil (HTTP 200) | Lulus |
| P-14 | Operator | Memulai produksi | Berhasil (HTTP 200) | Lulus |
| P-15 | Operator | Pemeriksaan: hasil belum sesuai (Perbaikan) | Berhasil (HTTP 200) | Lulus |
| P-16 | Operator | Mulai perbaikan | Berhasil (HTTP 200) | Lulus |
| P-17 | Operator | Pemeriksaan ulang: sesuai (Lolos pemeriksaan) | Berhasil (HTTP 200) | Lulus |
| P-18 | Front Office | Menetapkan status siap diambil | Berhasil (HTTP 200) | Lulus |
| P-19 | Pelanggan | Pelanggan melihat status Siap diambil dan sisa tagihan 60.000 | Status dan tagihan sesuai | Lulus |
| P-20 | Front Office | Mencatat pemberitahuan ke pelanggan (WhatsApp) | Berhasil (HTTP 200) | Lulus |
| P-21 | Front Office | Mencatat pelunasan 60.000 (QRIS) | Berhasil (HTTP 200) | Lulus |
| P-22 | Front Office | Mencatat penyerahan kepada penerima | Berhasil (HTTP 200) | Lulus |
| P-24 | Pelanggan | Berkas pendukung dapat diunduh dari server (inline untuk PNG) | HTTP 200, image/png, nosniff | Lulus |
| P-25 | Tim Desain | Berkas ZIP diterima dan diunduh sebagai lampiran (bukan inline) | HTTP 201 lalu attachment | Lulus |
| P-27 | Admin | Katalog: tambah produk lalu tampil di etalase publik | Produk terlihat | Lulus |
| P-28 | Admin | Metode pembayaran baru dapat dipakai FO; yang dinonaktifkan ditolak | Diterima lalu ditolak | Lulus |
| P-29 | Admin | Nonaktifkan pengguna: sesi berakhir dan login ditolak | HTTP 401 setelahnya | Lulus |
| P-30 | Semua aktor | Ubah kata sandi sendiri; sandi lama tidak berlaku, sandi baru berlaku | Login dengan sandi baru | Lulus |
| P-31 | Semua aktor | Keluar mengakhiri sesi | HTTP 401 setelah keluar | Lulus |
| P-23 | Semua aktor | Hasil akhir: Selesai, lunas 100.000, 2 versi desain, 1 revisi, 1 kendala, 1 pemberitahuan, 1 berkas | Nilai sesuai | Lulus |

## 5. Alur negatif — per aktor

### Pelanggan
| ID | Aktor | Skenario | Hasil yang diharapkan | Hasil |
|---|---|---|---|---|
| N-01 | Pelanggan | Pesanan tanpa nama pesanan | Ditolak (HTTP 400) | Lulus |
| N-02 | Pelanggan | Pesanan dengan jumlah 0 | Ditolak (HTTP 400) | Lulus |
| N-03 | Pelanggan | Unggah berkas HTML ditolak (jenis tidak didukung) | Ditolak (HTTP 415) | Lulus |
| N-04 | Pelanggan | Pelanggan lain (c2) tidak melihat pesanan | Tidak terlihat | Lulus |
| N-06 | Pelanggan | Pelanggan memverifikasi pesanan sendiri | Ditolak (HTTP 400) | Lulus |
| N-14 | Pelanggan | Menyetujui desain sebelum ada desain | Ditolak (HTTP 400) | Lulus |
| N-15 | Pelanggan | Pelanggan mengunggah desain | Ditolak (HTTP 400) | Lulus |
| N-17 | Pelanggan | Revisi tanpa catatan | Ditolak (HTTP 400) | Lulus |
| N-18 | Pelanggan | Pelanggan lain (c2) menyetujui desain | Ditolak (HTTP 400) | Lulus |
| N-19 | Pelanggan | Meminta revisi setelah desain disetujui | Ditolak (HTTP 400) | Lulus |
| N-22 | Pelanggan | Pelanggan mencatat pembayaran | Ditolak (HTTP 400) | Lulus |
| N-44 | Pelanggan | Meminta revisi pada pesanan Selesai | Ditolak (HTTP 400) | Lulus |
| N-48 | Pelanggan | Berkas yang sudah terpasang pada pesanan tidak dapat dipakai ulang | Ditolak (HTTP 400) | Lulus |
| N-49 | Pelanggan | Berkas milik pengguna lain (c2) tidak dapat dipasang oleh c1 | Ditolak (HTTP 400) | Lulus |
| N-50 | Pelanggan | Isi berkas tidak sesuai ekstensi (teks bernama .png) | Ditolak (HTTP 415) | Lulus |
| N-51 | Pelanggan | Unggah berkas kosong | Ditolak (HTTP 400) | Lulus |
| N-61 | Pelanggan | Pelanggan membuka API Admin | HTTP 403 | Lulus |
| N-70 | Pelanggan | Berkas milik pesanan orang lain tidak dapat diunduh | HTTP 404 | Lulus |

### Operator/Desain
| ID | Aktor | Skenario | Hasil yang diharapkan | Hasil |
|---|---|---|---|---|
| N-05 | Operator/Desain | Operator dan Tim Desain belum melihat pesanan yang belum ditugaskan | Tidak terlihat | Lulus |

### Front Office
| ID | Aktor | Skenario | Hasil yang diharapkan | Hasil |
|---|---|---|---|---|
| N-07 | Front Office | DP melebihi total biaya | Ditolak (HTTP 400) | Lulus |
| N-08 | Front Office | Tanggal tenggat tidak valid | Ditolak (HTTP 400) | Lulus |
| N-09 | Front Office | Petugas desain tidak sesuai peran | Ditolak (HTTP 400) | Lulus |
| N-10 | Front Office | Meneruskan ke produksi sebelum verifikasi dan desain | Ditolak (HTTP 400) | Lulus |
| N-11 | Front Office | Verifikasi ulang pesanan yang sudah terverifikasi | Ditolak (HTTP 400) | Lulus |
| N-21 | Front Office | Meneruskan ke produksi saat DP belum tercatat | Ditolak (HTTP 400) | Lulus |
| N-23 | Front Office | Pembayaran melebihi sisa tagihan | Ditolak (HTTP 400) | Lulus |
| N-24 | Front Office | Metode pembayaran tidak valid | Ditolak (HTTP 400) | Lulus |
| N-25 | Front Office | Nominal pembayaran 0 | Ditolak (HTTP 400) | Lulus |
| N-26 | Front Office | Meneruskan ke produksi saat DP baru sebagian | Ditolak (HTTP 400) | Lulus |
| N-29 | Front Office | FO mencatat kendala produksi | Ditolak (HTTP 400) | Lulus |
| N-34 | Front Office | FO menetapkan siap diambil saat hasil belum lolos | Ditolak (HTTP 400) | Lulus |
| N-36 | Front Office | Mencatat pemberitahuan sebelum status siap diambil | Ditolak (HTTP 400) | Lulus |
| N-37 | Front Office | Penyerahan sebelum status siap diambil | Ditolak (HTTP 400) | Lulus |
| N-38 | Front Office | Saluran pemberitahuan tidak valid | Ditolak (HTTP 400) | Lulus |
| N-40 | Front Office | Penyerahan saat tagihan belum lunas | Ditolak (HTTP 400) | Lulus |
| N-42 | Front Office | Penyerahan tanpa nama penerima | Ditolak (HTTP 400) | Lulus |
| N-43 | Front Office | Mengubah pesanan yang sudah Selesai (pembayaran) | Ditolak (HTTP 400) | Lulus |
| N-45 | Front Office | Aksi tidak dikenal pada pesanan aktif | Ditolak (HTTP 400) | Lulus |
| N-46 | Front Office | Aksi dengan nomor revisi usang | Ditolak (HTTP 409) | Lulus |
| N-62 | Front Office | FO membuat pengguna lewat API Admin | HTTP 403 | Lulus |

### Tim Desain
| ID | Aktor | Skenario | Hasil yang diharapkan | Hasil |
|---|---|---|---|---|
| N-12 | Tim Desain | Desainer lain tidak ada; operator tidak melihat pesanan milik pelanggan lain | Operator hanya melihat tugasnya | Lulus |
| N-13 | Tim Desain | Menetapkan final sebelum ada desain disetujui | Ditolak (HTTP 400) | Lulus |
| N-16 | Tim Desain | Unggah desain berformat .exe ditolak | Ditolak (HTTP 415) | Lulus |
| N-20 | Tim Desain | Mengunggah desain setelah disetujui | Ditolak (HTTP 400) | Lulus |

### Operator
| ID | Aktor | Skenario | Hasil yang diharapkan | Hasil |
|---|---|---|---|---|
| N-27 | Operator | Operator mulai produksi sebelum diteruskan FO | Ditolak (HTTP 400) | Lulus |
| N-28 | Operator | Operator meneruskan ke produksi | Ditolak (HTTP 400) | Lulus |
| N-30 | Operator | Pemeriksaan hasil sebelum produksi dimulai | Ditolak (HTTP 400) | Lulus |
| N-31 | Operator | Kendala tanpa catatan | Ditolak (HTTP 400) | Lulus |
| N-32 | Operator | Memulai produksi dua kali | Ditolak (HTTP 400) | Lulus |
| N-33 | Operator | Pemeriksaan tanpa catatan | Ditolak (HTTP 400) | Lulus |
| N-35 | Operator | Operator menetapkan siap diambil | Ditolak (HTTP 400) | Lulus |
| N-39 | Operator | Operator mencatat pemberitahuan | Ditolak (HTTP 400) | Lulus |
| N-41 | Operator | Operator mencatat penyerahan | Ditolak (HTTP 400) | Lulus |

### Sistem
| ID | Aktor | Skenario | Hasil yang diharapkan | Hasil |
|---|---|---|---|---|
| N-47 | Sistem | Permintaan lintas asal (Origin berbeda) | Ditolak (HTTP 403) | Lulus |
| N-52 | Sistem | Unduh berkas dengan id tidak ada | HTTP 404 | Lulus |
| N-53 | Sistem | Unggah tanpa login ditolak | Ditolak (HTTP 401) | Lulus |
| N-54 | Sistem | Nama berkas berisi path traversal dibersihkan | Nama tersimpan tanpa path | Lulus |
| N-56 | Sistem | State tanpa login ditolak | HTTP 401 | Lulus |
| N-57 | Sistem | Parameter ?user= tidak dapat menyamar sebagai FO | Tetap sebagai c1 | Lulus |
| N-58 | Sistem | Login dengan kata sandi salah | HTTP 401 | Lulus |
| N-59 | Sistem | Pesan galat login sama untuk username tidak ada dan sandi salah | Pesan identik | Lulus |
| N-60 | Sistem | Pembatas percobaan login (8 gagal) | HTTP 429 | Lulus |
| N-63 | Sistem | Pendaftaran mandiri tidak tersedia | Bukan HTTP 2xx | Lulus |

### Admin
| ID | Aktor | Skenario | Hasil yang diharapkan | Hasil |
|---|---|---|---|---|
| N-64 | Admin | Akun dengan kata sandi pendek ditolak | HTTP 400 | Lulus |
| N-65 | Admin | Username ganda ditolak | HTTP 409 | Lulus |
| N-66 | Admin | Admin tidak dapat menonaktifkan akunnya sendiri | Ditolak (HTTP 400) | Lulus |
| N-67 | Admin | Admin tidak dapat mengubah peran sendiri | Ditolak (HTTP 400) | Lulus |
| N-68 | Admin | Peran pengguna yang terkait pesanan tidak dapat diubah | Ditolak (HTTP 400) | Lulus |
| N-69 | Admin | Metode pembayaran terakhir tidak dapat dinonaktifkan | Ditolak (HTTP 400) | Lulus |

## 6. Pemeriksaan antarmuka per peran (manual, peramban)
| Peran | Menu yang tampil | Hasil |
|---|---|---|
| Pelanggan (Alya Putri) | Beranda, Buat Pesanan, Pesanan Saya | Sesuai, tanpa galat |
| Tim Desain (Raka) | Beranda, Tugas Desain | Sesuai, tanpa galat |
| Operator (Bagas) | Beranda, Produksi | Sesuai, tanpa galat |
| Front Office (Nadia) | Beranda, Pesanan, Pelanggan, Pembayaran, Penyerahan | Sesuai, tanpa galat |

## 7. Aturan bisnis yang tercakup
DP per pesanan oleh FO (P-03, P-10, P-11, N-07); persetujuan desain hanya oleh pelanggan pemilik (N-14, N-18); revisi hanya sebelum disetujui (N-19); final oleh Tim Desain setelah disetujui (N-13); gerbang produksi desain final + DP terpenuhi (N-10, N-21, N-26); Perbaikan bila hasil belum sesuai (P-15, N-34); Siap diambil oleh FO (P-18, N-35); Selesai hanya bila lunas dan penerima dicatat (N-40, N-42, P-22); akses per peran dan kepemilikan (N-04, N-05, N-12, N-15, N-22, N-41); integritas (N-46 revisi usang, N-47 lintas asal); berkas: jenis dan isi (N-03, N-16, N-50), kosong (N-51), kepemilikan dan pemakaian ulang (N-48, N-49), nama aman (N-54), unduhan (P-24, P-25, N-52), pengunggah tidak dikenal (N-53), batas 500 MB (P-26, N-55).

## 8. Temuan dan catatan
- Satu cacat ditemukan dan diperbaiki selama uji (N-48, klaim berkas); setelah perbaikan tidak ada cacat pada 99 kasus.
- Pengamatan (bukan cacat): pesan galat aksi tidak dikenal baru muncul pada pesanan aktif; pada pesanan Selesai semua aksi dijawab «Pesanan sudah selesai».
- Keterbatasan keamanan (bukan hasil uji): pembatas login hanya di memori proses; belum ada HTTPS bawaan atau pemulihan kata sandi. Unduhan berkas kini memerlukan sesi dan keterkaitan dengan pesanan (N-70).
- Situs publik dan paket portabel belum diuji ulang. Kasus TC-01..TC-24 pada laporan bersifat uji domain dan API sebelumnya.

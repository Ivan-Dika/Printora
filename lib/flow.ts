import {finalDesign, printFileId, paid, money, roles, type Order, type Role} from './domain';

export const APP_NAME = 'Printora';
export const APP_TAGLINE = 'Sistem pesanan percetakan dari pengajuan sampai penyerahan';

export type Phase = {key: string; title: string; who: string; desc: string; statuses: string[]; roles: Role[]; test: (o: Order) => boolean};

/** Pesanan berstatus "Desain" yang desainnya sudah disetujui (atau langsung cetak): tahap sebenarnya adalah pembayaran DP. */
export const inDpStage = (o: Order) => o.status === 'Desain' && o.verified && (o.mode === 'cetak' || !!o.designs.at(-1)?.approved);

/** Label tahap yang ditampilkan ke pengguna. Status internal tetap sama; label ini hanya menjelaskan posisi pesanan yang sebenarnya. */
export function stageInfo(o: Order): {label: string; tone: number} {
  const tone = ['Menunggu verifikasi', 'Desain', 'Siap produksi', 'Dalam produksi', 'Perbaikan', 'Lolos pemeriksaan', 'Siap diambil', 'Selesai'].indexOf(o.status);
  if (o.status === 'Desain') {
    const dpLeft = o.dp - paid(o);
    const last = o.designs.at(-1);
    if (inDpStage(o)) return dpLeft > 0 ? {label: 'Menunggu pembayaran DP', tone: 0} : {label: last && !last.final ? 'Menyiapkan berkas final' : 'Siap diteruskan ke produksi', tone: 2};
    if (!last) return {label: 'Desain sedang dibuat', tone};
    if (o.revisions.length >= o.designs.length) return {label: 'Revisi desain', tone};
    return {label: 'Menunggu persetujuan desain', tone};
  }
  if (o.status === 'Siap diambil' && paid(o) < o.total) return {label: 'Siap diambil, belum lunas', tone};
  return {label: o.status, tone};
}

// Tujuh fase yang tampil sebagai alur ringkas di Beranda dan Panduan.
export const PHASES: Phase[] = [
  {key: 'verifikasi', title: 'Verifikasi', who: 'Front Office', desc: 'Periksa spesifikasi; tetapkan biaya, DP, tenggat, dan petugas.', statuses: ['Menunggu verifikasi'], roles: ['fo'], test: (o) => o.status === 'Menunggu verifikasi'},
  {key: 'desain', title: 'Desain', who: 'Tim Desain & Pelanggan', desc: 'Unggah desain, revisi, dan persetujuan pelanggan.', statuses: ['Desain'], roles: ['designer', 'customer'], test: (o) => o.status === 'Desain' && !inDpStage(o)},
  {key: 'dp', title: 'Pembayaran DP', who: 'Pelanggan & Front Office', desc: 'Pelanggan membayar DP, FO mengonfirmasi, lalu pesanan diteruskan ke produksi.', statuses: ['Desain'], roles: ['customer', 'fo'], test: inDpStage},
  {key: 'antrean', title: 'Antrean produksi', who: 'Operator', desc: 'Desain final disetujui dan DP terpenuhi; menunggu dikerjakan.', statuses: ['Siap produksi'], roles: ['operator'], test: (o) => o.status === 'Siap produksi'},
  {key: 'produksi', title: 'Produksi & pemeriksaan', who: 'Operator', desc: 'Cetak, periksa hasil, perbaiki bila belum sesuai.', statuses: ['Dalam produksi', 'Perbaikan'], roles: ['operator'], test: (o) => ['Dalam produksi', 'Perbaikan'].includes(o.status)},
  {key: 'pengambilan', title: 'Pengambilan', who: 'Front Office', desc: 'Siap diambil, pemberitahuan, pelunasan, penyerahan.', statuses: ['Lolos pemeriksaan', 'Siap diambil'], roles: ['fo', 'customer'], test: (o) => ['Lolos pemeriksaan', 'Siap diambil'].includes(o.status)},
  {key: 'selesai', title: 'Selesai', who: 'Semua', desc: 'Pesanan lunas dan hasil diterima pelanggan.', statuses: ['Selesai'], roles: [], test: (o) => o.status === 'Selesai'},
];

export type Step = {n: number; role: Role; title: string; where: string; detail: string; gate?: string; after: string};
// Panduan langkah demi langkah (cara pakai). Syarat (gate) ditegakkan sistem. Nomor dibuat berurutan otomatis.
const RAW: Omit<Step, 'n'>[] = [
  {role: 'customer', title: 'Ajukan pesanan', where: 'Etalase → Pesan sekarang (atau Ruang Kerja → Buat pesanan)', detail: 'Isi nama, kontak, spesifikasi, jumlah, dan pilih opsi: "Desain dulu" oleh Tim Desain atau "Langsung cetak". Lampirkan berkas (wajib berkas siap cetak untuk Langsung cetak). Akun dibuat otomatis dan info akses dikirim lewat WhatsApp atau email.', after: 'Menunggu verifikasi'},
  {role: 'fo', title: 'Verifikasi pesanan', where: 'Pesanan → buka pesanan → Verifikasi pesanan', detail: 'Tetapkan total biaya, nominal DP, tenggat, serta Tim Desain dan Operator.', gate: 'DP tidak boleh melebihi total biaya.', after: 'Desain'},
  {role: 'customer', title: 'Bayar DP', where: 'Pesanan Saya → buka pesanan → Pembayaran → Bayar', detail: 'Pilih Transfer, Tunai, atau QRIS beserta nominalnya. QRIS tercatat otomatis setelah dipindai; Transfer dan Tunai menunggu konfirmasi FO. DP boleh dibayar kapan saja setelah pesanan diverifikasi, tidak perlu menunggu desain selesai.', gate: 'Hanya setelah diverifikasi; nominal tidak melebihi sisa tagihan.', after: 'Desain'},
  {role: 'fo', title: 'Konfirmasi atau catat DP', where: 'Pesanan → buka pesanan → Pembayaran', detail: 'Konfirmasi permintaan Transfer atau Tunai dari pelanggan setelah uangnya benar-benar diterima. Bila pelanggan membayar langsung di kasir, pilih Catat pembayaran.', gate: 'Nominal tidak boleh melebihi sisa tagihan.', after: 'Desain'},
  {role: 'fo', title: 'Tetapkan berkas cetak final', where: 'Pesanan → buka pesanan → Ringkasan → Berkas dari pelanggan', detail: 'Khusus Langsung cetak: pilih satu berkas pelanggan yang akan dicetak. Bila pelanggan hanya mengunggah satu berkas, berkas itu dipakai otomatis. Berkas terkunci setelah pesanan masuk produksi.', gate: 'Hanya setelah verifikasi dan sebelum produksi.', after: 'Desain'},
  {role: 'designer', title: 'Unggah desain', where: 'Tugas Desain → buka pesanan → Desain → Unggah desain', detail: 'Unggah versi desain. Revisi dari pelanggan dijawab dengan versi baru. (Tidak berlaku untuk pesanan Langsung cetak; unggahan desain ditolak sistem.)', gate: 'Tidak bisa setelah pelanggan menyetujui.', after: 'Desain'},
  {role: 'customer', title: 'Tinjau desain', where: 'Pesanan Saya → buka pesanan → Desain', detail: 'Setujui desain, atau minta revisi beserta catatannya.', gate: 'Revisi hanya sebelum desain disetujui.', after: 'Desain'},
  {role: 'designer', title: 'Tetapkan berkas final', where: 'Tugas Desain → buka pesanan → Desain', detail: 'Setelah pelanggan menyetujui, tetapkan versi itu sebagai berkas final. Selama langkah ini belum dilakukan, status pesanan tetap "Desain".', gate: 'Harus sudah disetujui pelanggan.', after: 'Desain (final)'},
  {role: 'fo', title: 'Teruskan ke produksi', where: 'Pesanan → buka pesanan → Ringkasan → Teruskan ke produksi', detail: 'Mengirim pesanan ke antrean Operator.', gate: 'Desain final (Desain dulu) atau berkas cetak final (Langsung cetak), DAN DP terpenuhi.', after: 'Siap produksi'},
  {role: 'operator', title: 'Mulai produksi', where: 'Produksi → Antrean → buka pesanan', detail: 'Mulai produksi; catat kendala bila ada (mis. bahan kosong).', after: 'Dalam produksi'},
  {role: 'operator', title: 'Periksa hasil cetak', where: 'Produksi → Sedang Dikerjakan → buka pesanan', detail: 'Catat hasil: sesuai atau belum sesuai, beserta catatan. Belum sesuai berarti Perbaikan, lalu ulangi "Mulai produksi".', gate: 'Catatan pemeriksaan wajib diisi.', after: 'Lolos pemeriksaan / Perbaikan'},
  {role: 'fo', title: 'Tandai siap diambil', where: 'Penyerahan → buka pesanan', detail: 'Tandai bahwa hasil siap diambil pelanggan. Pelanggan otomatis diberi tahu lewat WhatsApp atau email bila Admin sudah mengaktifkannya.', gate: 'Hasil harus lolos pemeriksaan.', after: 'Siap diambil'},
  {role: 'fo', title: 'Catat pemberitahuan manual', where: 'Penyerahan → Catat pemberitahuan ke pelanggan', detail: 'Opsional: bila pelanggan juga dihubungi lewat telepon atau tatap muka, catat salurannya. Pesan WhatsApp dan email dikirim otomatis oleh sistem pada tiap perubahan status penting.', after: 'Siap diambil'},
  {role: 'customer', title: 'Lunasi sisa tagihan', where: 'Pesanan Saya → buka pesanan → Pembayaran → Bayar', detail: 'Bayar sisa tagihan lewat aplikasi (QRIS, Transfer, atau Tunai), atau langsung di kasir saat mengambil pesanan.', gate: 'Nominal tidak melebihi sisa tagihan.', after: 'Siap diambil'},
  {role: 'fo', title: 'Konfirmasi atau catat pelunasan', where: 'Pesanan → buka pesanan → Pembayaran', detail: 'Konfirmasi permintaan pelunasan dari pelanggan, atau catat pembayaran yang diterima langsung saat pelanggan mengambil.', after: 'Siap diambil (lunas)'},
  {role: 'fo', title: 'Catat penyerahan', where: 'Penyerahan → Catat penyerahan', detail: 'Isi nama penerima. Pesanan menjadi Selesai dan terkunci.', gate: 'Tagihan harus lunas.', after: 'Selesai'},
];
export const STEPS: Step[] = RAW.map((x, i) => ({n: i + 1, ...x}));

export const ADMIN_TASKS: [string, string, string][] = [
  ['Kelola pengguna', 'Pengguna', 'Tambah akun staf (Front Office, Tim Desain, Operator) dan Admin lain; ubah nama, telepon, peran, dan status aktif; atur ulang kata sandi. Akun nonaktif tidak dapat masuk dan sesinya diakhiri.'],
  ['Kelola katalog layanan', 'Master Data', 'Tambah, ubah, urutkan, atau sembunyikan produk yang tampil di etalase. Perubahan langsung terlihat oleh pelanggan.'],
  ['Kelola metode pembayaran dan saluran pemberitahuan', 'Master Data', 'Daftar pilihan yang dipakai FO saat mencatat pembayaran dan pemberitahuan. Minimal satu pilihan harus tetap aktif.'],
  ['Pantau pesanan', 'Pesanan', 'Admin dapat melihat seluruh pesanan, tetapi tidak menjalankan tahap pesanan (itu tugas FO, Tim Desain, dan Operator).'],
];

export const FAQ: [string, string][] = [
  ['Mengapa tombol "Teruskan ke produksi" tidak aktif?', 'Produksi hanya dapat dimulai bila desain final sudah disetujui pelanggan dan DP sudah tercatat penuh. Lihat daftar "Langkah berikutnya" pada pesanan.'],
  ['Mengapa saya tidak bisa meminta revisi lagi?', 'Revisi hanya dapat diminta sebelum desain disetujui. Setelah disetujui, desain dikunci dan menjadi dasar berkas final.'],
  ['Mengapa "Catat penyerahan" nonaktif?', 'Penyerahan hanya dapat dicatat saat status Siap diambil dan tagihan lunas. Catat pelunasan di tab Pembayaran dahulu.'],
  ['Apa yang terjadi bila hasil cetak belum sesuai?', 'Operator mencatat "belum sesuai". Status menjadi Perbaikan; Operator memperbaiki lalu memeriksa ulang sampai hasil lolos.'],
  ['Apakah sistem mengirim pesan ke pelanggan?', 'Ya, bila Admin mengaktifkan WhatsApp (WAHA) dan atau email (SMTP) di Pengaturan. Pelanggan menerima pesan saat pesanan diterima, diverifikasi, desain siap ditinjau, pembayaran masuk, produksi berjalan, siap diambil, dan selesai. FO tetap dapat mencatat pemberitahuan manual.'],
  ['Mengapa pesanan masih berstatus "Desain" padahal desain sudah disetujui?', 'Status baru berubah ke "Siap produksi" setelah tiga hal terpenuhi: pelanggan menyetujui desain, Tim Desain menekan "Tetapkan sebagai berkas final", dan DP tercatat penuh, lalu FO menekan "Teruskan ke produksi". Lihat kotak "Giliran" di atas pesanan untuk tahu siapa yang sedang ditunggu.'],
  ['Kapan pelanggan boleh membayar DP?', 'Segera setelah FO memverifikasi pesanan, lewat tab Pembayaran. Tidak perlu menunggu desain selesai; produksi hanya menunggu DP dan desain final.'],
  ['Siapa yang membuat akun?', 'Akun staf (Front Office, Tim Desain, Operator) dibuat oleh Admin Aplikasi. Akun pelanggan dibuat otomatis saat memesan di etalase; username dan kata sandi sementara dikirim lewat WhatsApp atau email dan tampil sekali di layar, lalu wajib diganti saat masuk pertama.'],
  ['Bagaimana pelanggan membayar?', 'Pelanggan memilih Transfer, Tunai, atau QRIS di Pesanan saya. QRIS tercatat otomatis; Transfer dan Tunai dikonfirmasi FO di tab Pembayaran.'],
];

/** Giliran saat ini pada sebuah pesanan: siapa yang harus bertindak dan apa yang harus dilakukan. */
export function turn(o: Order, viewer?: Role): {role: Role; text: string; note?: string} | null {
  // Bagi pelanggan, langkah miliknya (bayar) yang ditonjolkan; pihak lain yang ikut ditunggu disebut sebagai catatan.
  if (viewer === 'customer' && inDpStage(o) && o.dp - paid(o) > 0) {
    const last = o.designs.at(-1);
    return {role: 'customer', text: 'Bayar DP ' + money(o.dp - paid(o)) + ' lewat tab Pembayaran agar produksi dapat dimulai.', note: last && !last.final ? 'Tim Desain sedang menyiapkan berkas final. Pembayaran tidak perlu menunggu.' : 'FO akan meneruskan pesanan ke produksi setelah DP tercatat.'};
  }
  switch (o.status) {
    case 'Menunggu verifikasi': return {role: 'fo', text: 'Verifikasi pesanan: tetapkan biaya, DP, tenggat, dan petugas.'};
    case 'Desain': {
      const last = o.designs.at(-1);
      const dpLeft = o.dp - paid(o);
      const note = dpLeft > 0
        ? 'DP belum terpenuhi (kurang ' + money(dpLeft) + '). Pelanggan dapat membayar di tab Pembayaran; FO mengonfirmasi atau mencatatnya.'
        : 'DP sudah terpenuhi.';
      if (!last) return o.mode === 'cetak'
        ? (!o.attachments?.length ? {role: 'customer', text: 'Unggah berkas siap cetak untuk pesanan ini.', note}
          : !printFileId(o) ? {role: 'fo', text: 'Tetapkan satu berkas pelanggan sebagai berkas cetak final.', note}
          : dpLeft > 0 ? {role: 'fo', text: 'Catat DP (kurang ' + money(dpLeft) + ') agar produksi dapat dimulai.', note: 'Pelanggan dapat membayar di tab Pembayaran.'} : {role: 'fo', text: 'Teruskan pesanan (berkas cetak final sudah ditetapkan) ke produksi.'})
        : {role: 'designer', text: 'Unggah versi desain pertama.', note};
      if (last.approved && !last.final) return {role: 'designer', text: 'Tetapkan desain yang disetujui sebagai berkas final.', note};
      if (last.approved && last.final) return dpLeft > 0
        ? {role: 'fo', text: 'Konfirmasi atau catat DP (kurang ' + money(dpLeft) + ') agar produksi dapat dimulai.', note: 'Pelanggan dapat membayar lewat tab Pembayaran.'}
        : {role: 'fo', text: 'Teruskan pesanan ke produksi.'};
      if (o.revisions.length >= o.designs.length) return {role: 'designer', text: 'Unggah versi revisi sesuai catatan pelanggan.', note};
      return {role: 'customer', text: 'Tinjau desain: setujui atau minta revisi.', note};
    }
    case 'Siap produksi': return {role: 'operator', text: 'Mulai produksi dari antrean.'};
    case 'Dalam produksi': return {role: 'operator', text: 'Selesaikan cetak, lalu catat hasil pemeriksaan.'};
    case 'Perbaikan': return {role: 'operator', text: 'Perbaiki hasil, lalu mulai ulang pemeriksaan.'};
    case 'Lolos pemeriksaan': return {role: 'fo', text: 'Tandai pesanan siap diambil.'};
    case 'Siap diambil': return paid(o) < o.total
      ? {role: 'fo', text: 'Konfirmasi atau catat pelunasan (sisa ' + money(o.total - paid(o)) + ') lalu catat penyerahan.', note: 'Pelanggan dapat melunasi lewat tab Pembayaran atau langsung di kasir.'}
      : {role: 'fo', text: 'Catat penyerahan kepada penerima.'};
    default: return null;
  }
}
export const roleName = (r: Role) => roles[r];

/** Penjelasan untuk pengunjung (etalase): langkah berikutnya dari sudut pandang pelanggan. */
export function visitorNext(o: Order): string {
  switch (o.status) {
    case 'Menunggu verifikasi': return 'Menunggu FO memeriksa spesifikasi lalu menetapkan biaya, DP, dan tenggat.';
    case 'Desain': {
      const last = o.designs.at(-1);
      if (!last) return 'Tim desain sedang menyiapkan desain pertama Anda.';
      if (last.approved) { const left = o.dp - paid(o); return 'Desain disetujui.' + (finalDesign(o) ? '' : ' Tim desain menetapkan berkas final.') + (left > 0 ? ' Bayar DP ' + money(left) + ' lewat tab Pembayaran; produksi dimulai setelah DP tercatat.' : ' DP sudah terpenuhi; menunggu FO meneruskan ke produksi.'); }
      if (o.revisions.length >= o.designs.length) return 'Revisi Anda sedang dikerjakan tim desain.';
      return 'Giliran Anda: tinjau desain di bawah, lalu setujui atau minta revisi.';
    }
    case 'Siap produksi': case 'Dalam produksi': case 'Perbaikan': case 'Lolos pemeriksaan': return 'Pesanan sedang diproduksi dan diperiksa kualitasnya.';
    case 'Siap diambil': return 'Pesanan siap diambil. Sebutkan nomor pesanan dan lunasi sisa tagihan saat pengambilan.';
    case 'Selesai': return 'Pesanan selesai. Terima kasih telah mencetak bersama kami.';
    default: return '';
  }
}
export const VISITOR_STAGES = ['Verifikasi', 'Desain', 'Produksi', 'Siap diambil', 'Selesai'];
export function visitorStage(o: Order): number {
  if (o.status === 'Menunggu verifikasi') return 0;
  if (o.status === 'Desain') return 1;
  if (['Siap produksi', 'Dalam produksi', 'Perbaikan', 'Lolos pemeriksaan'].includes(o.status)) return 2;
  if (o.status === 'Siap diambil') return 3;
  return 4;
}

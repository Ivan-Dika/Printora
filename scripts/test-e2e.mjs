// QC end-to-end melalui API: satu pesanan dari pengajuan sampai penyerahan, dari sisi empat aktor,
// dengan kasus positif (P) dan negatif (N). Pemakaian: node scripts/test-e2e.mjs [http://127.0.0.1:8787]
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import {bootstrap, Session} from './test-lib.mjs';
const base = process.argv[2] || 'http://127.0.0.1:8787';
const {S, ID} = await bootstrap(base);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('berkas-uji-e2e')]);
const ZIP = Buffer.concat([Buffer.from('PK'), Buffer.alloc(64)]);
const FAKE = '99999999-9999-4999-8999-999999999999';
const upload = (user, name, bytes) => S[user].upload(name, bytes);
const fileId = async (user, name, bytes = PNG) => { const r = await upload(user, name, bytes); assert.equal(r.status, 201, JSON.stringify(r.body)); return r.body.id; };
let revision = 0, orderId = '';
const results = [];
async function call(user, action, data = {}, opt = {}) {
  const r = await S[user].json('/api/state', {action, data, revision: opt.revision ?? revision}, opt.headers ? {headers: {'Content-Type': 'application/json', ...opt.headers}} : {});
  if (r.status === 200 && opt.track !== false) revision = r.body.revision;
  return {status: r.status, body: r.body};
}
async function view(user) { const r = await S[user].json('/api/state'); revision = r.body.revision; return r.body; }
const order = async user => (await view(user)).orders.find(o => o.id === orderId);
async function check(id, actor, title, expected, fn) {
  let ok = false, detail = '';
  try { await fn(); ok = true; } catch (e) { detail = e.message.replace(/\s+/g, ' ').slice(0, 240); }
  results.push({id, actor, title, expected, ok, detail});
  console.log((ok ? 'LULUS ' : 'GAGAL ') + id + ' [' + actor + '] ' + title + (ok ? '' : ' -> ' + detail));
}
const accept = async (id, actor, title, user, action, data, after) => check(id, actor, title, 'Berhasil (HTTP 200)', async () => {
  const r = await call(user, action, data); assert.equal(r.status, 200, JSON.stringify(r.body)); if (after) await after(r);
});
const reject = async (id, actor, title, user, action, data, pattern, status = 400) => check(id, actor, title, 'Ditolak (HTTP ' + status + ')', async () => {
  const r = await call(user, action, data); assert.equal(r.status, status, 'status ' + r.status); if (pattern) assert.match(r.body.error || '', pattern);
});

// ---------- Pelanggan: mengajukan pesanan ----------
await view('c2');
const spare = await call('c2', 'create', {title: 'Pesanan cadangan c2', spec: 'Untuk uji aksi tak dikenal', qty: 1}); assert.equal(spare.status, 200, JSON.stringify(spare.body));
const spareId = spare.body.orders[0].id;
await view('c1');
await reject('N-01', 'Pelanggan', 'Pesanan tanpa nama pesanan', 'c1', 'create', {spec: 'Banner', qty: 1}, /wajib/);
await reject('N-02', 'Pelanggan', 'Pesanan dengan jumlah 0', 'c1', 'create', {title: 'X', spec: 'Y', qty: 0}, /tidak valid/);
await check('N-03', 'Pelanggan', 'Unggah berkas HTML ditolak (jenis tidak didukung)', 'Ditolak (HTTP 415)', async () => { const r = await upload('c1', 'a.html', Buffer.from('<h1>x</h1>')); assert.equal(r.status, 415); });
await accept('P-01', 'Pelanggan', 'Mengajukan pesanan dengan berkas pendukung', 'c1', 'create', {title: 'Uji E2E Banner', spec: 'Banner flexi 3 x 1 m', qty: 2, file: await fileId('c1', 'logo.png'), fileName: 'logo.png'}, r => { orderId = r.body.orders[0].id; assert.equal(r.body.orders[0].status, 'Menunggu verifikasi'); });
await check('P-02', 'Pelanggan', 'Berkas pendukung tersimpan pada pesanan', 'Ada 1 berkas', async () => { assert.equal((await order('c1')).attachments.length, 1); });
await check('N-04', 'Pelanggan', 'Pelanggan lain (c2) tidak melihat pesanan', 'Tidak terlihat', async () => { assert.ok(!(await view('c2')).orders.some(o => o.id === orderId)); });
await check('N-05', 'Operator/Desain', 'Operator dan Tim Desain belum melihat pesanan yang belum ditugaskan', 'Tidak terlihat', async () => { for (const u of ['operator', 'design']) assert.ok(!(await view(u)).orders.some(o => o.id === orderId)); });
await reject('N-06', 'Pelanggan', 'Pelanggan memverifikasi pesanan sendiri', 'c1', 'verify', {orderId, total: 100000, dp: 40000, due: '2026-12-10', designerId: ID.design, operatorId: ID.operator}, /peran/);

// ---------- Front Office: verifikasi ----------
await reject('N-07', 'Front Office', 'DP melebihi total biaya', 'fo', 'verify', {orderId, total: 100000, dp: 150000, due: '2026-12-10', designerId: ID.design, operatorId: ID.operator}, /DP/);
await reject('N-08', 'Front Office', 'Tanggal tenggat tidak valid', 'fo', 'verify', {orderId, total: 100000, dp: 40000, due: '10-12-2026', designerId: ID.design, operatorId: ID.operator}, /Tanggal/);
await reject('N-09', 'Front Office', 'Petugas desain tidak sesuai peran', 'fo', 'verify', {orderId, total: 100000, dp: 40000, due: '2026-12-10', designerId: ID.operator, operatorId: ID.operator}, /Penugasan/);
await reject('N-10', 'Front Office', 'Meneruskan ke produksi sebelum verifikasi dan desain', 'fo', 'release', {orderId}, /desain final/);
await accept('P-03', 'Front Office', 'Verifikasi: total 100.000, DP 40.000, tenggat, petugas', 'fo', 'verify', {orderId, total: 100000, dp: 40000, due: '2026-12-10', designerId: ID.design, operatorId: ID.operator}, r => assert.equal(r.body.orders.find(o => o.id === orderId).status, 'Desain'));
await reject('N-11', 'Front Office', 'Verifikasi ulang pesanan yang sudah terverifikasi', 'fo', 'verify', {orderId, total: 100000, dp: 40000, due: '2026-12-10', designerId: ID.design, operatorId: ID.operator}, /sudah/);
await check('P-04', 'Tim Desain/Operator', 'Tim Desain dan Operator kini melihat pesanan yang ditugaskan', 'Terlihat', async () => { for (const u of ['operator', 'design']) assert.ok((await view(u)).orders.some(o => o.id === orderId)); });
await check('N-12', 'Tim Desain', 'Desainer lain tidak ada; operator tidak melihat pesanan milik pelanggan lain', 'Operator hanya melihat tugasnya', async () => { assert.ok((await view('operator')).orders.every(o => o.operatorId === ID.operator)); });

// ---------- Tim Desain dan Pelanggan: desain ----------
await reject('N-13', 'Tim Desain', 'Menetapkan final sebelum ada desain disetujui', 'design', 'final', {orderId}, /disetujui/);
await reject('N-14', 'Pelanggan', 'Menyetujui desain sebelum ada desain', 'c1', 'approve', {orderId}, /Belum ada desain/);
await reject('N-15', 'Pelanggan', 'Pelanggan mengunggah desain', 'c1', 'upload', {orderId, name: 'a.png', file: FAKE}, /peran/);
await check('N-16', 'Tim Desain', 'Unggah desain berformat .exe ditolak', 'Ditolak (HTTP 415)', async () => { const r = await upload('design', 'a.exe', ZIP); assert.equal(r.status, 415); });
await accept('P-05', 'Tim Desain', 'Mengunggah desain versi 1', 'design', 'upload', {orderId, name: 'desain-v1.png', file: await fileId('design', 'desain-v1.png'), note: 'Versi awal'});
await accept('P-06', 'Pelanggan', 'Meminta revisi desain', 'c1', 'revision', {orderId, note: 'Perbesar judul'});
await reject('N-17', 'Pelanggan', 'Revisi tanpa catatan', 'c1', 'revision', {orderId, note: ''}, /wajib/);
await accept('P-07', 'Tim Desain', 'Mengunggah desain versi 2 (revisi)', 'design', 'upload', {orderId, name: 'desain-v2.png', file: await fileId('design', 'desain-v2.png')});
await reject('N-18', 'Pelanggan', 'Pelanggan lain (c2) menyetujui desain', 'c2', 'approve', {orderId}, /diakses/);
await accept('P-08', 'Pelanggan', 'Menyetujui desain versi 2', 'c1', 'approve', {orderId});
await reject('N-19', 'Pelanggan', 'Meminta revisi setelah desain disetujui', 'c1', 'revision', {orderId, note: 'Ubah lagi'}, /sebelum/);
await reject('N-20', 'Tim Desain', 'Mengunggah desain setelah disetujui', 'design', 'upload', {orderId, name: 'v3.png', file: FAKE}, /disetujui/);
await accept('P-09', 'Tim Desain', 'Menetapkan berkas final', 'design', 'final', {orderId});

// ---------- Front Office: pembayaran dan gerbang produksi ----------
await reject('N-21', 'Front Office', 'Meneruskan ke produksi saat DP belum tercatat', 'fo', 'release', {orderId}, /DP/);
await reject('N-22', 'Pelanggan', 'Pelanggan mencatat pembayaran', 'c1', 'pay', {orderId, amount: 40000, method: 'Tunai'}, /peran/);
await reject('N-23', 'Front Office', 'Pembayaran melebihi sisa tagihan', 'fo', 'pay', {orderId, amount: 100001, method: 'Tunai'}, /melebihi/);
await reject('N-24', 'Front Office', 'Metode pembayaran tidak valid', 'fo', 'pay', {orderId, amount: 10000, method: 'Kripto'}, /Metode/);
await reject('N-25', 'Front Office', 'Nominal pembayaran 0', 'fo', 'pay', {orderId, amount: 0, method: 'Tunai'}, /tidak valid/);
await accept('P-10', 'Front Office', 'Mencatat DP sebagian 20.000', 'fo', 'pay', {orderId, amount: 20000, method: 'Tunai'});
await reject('N-26', 'Front Office', 'Meneruskan ke produksi saat DP baru sebagian', 'fo', 'release', {orderId}, /DP/);
await accept('P-11', 'Front Office', 'Melengkapi DP 20.000 (total DP 40.000)', 'fo', 'pay', {orderId, amount: 20000, method: 'Transfer'});
await reject('N-27', 'Operator', 'Operator mulai produksi sebelum diteruskan FO', 'operator', 'start', {orderId}, /antrean/);
await reject('N-28', 'Operator', 'Operator meneruskan ke produksi', 'operator', 'release', {orderId}, /peran/);
await accept('P-12', 'Front Office', 'Meneruskan pesanan ke produksi (DP terpenuhi, desain final)', 'fo', 'release', {orderId}, r => assert.equal(r.body.orders.find(o => o.id === orderId).status, 'Siap produksi'));

// ---------- Operator: produksi ----------
await reject('N-29', 'Front Office', 'FO mencatat kendala produksi', 'fo', 'issue', {orderId, note: 'x'}, /peran/);
await reject('N-30', 'Operator', 'Pemeriksaan hasil sebelum produksi dimulai', 'operator', 'qc', {orderId, pass: true, note: 'Sesuai'}, /belum dimulai/);
await accept('P-13', 'Operator', 'Mencatat kendala saat berada di antrean', 'operator', 'issue', {orderId, note: 'Menunggu stok flexi'});
await reject('N-31', 'Operator', 'Kendala tanpa catatan', 'operator', 'issue', {orderId, note: ''}, /wajib/);
await accept('P-14', 'Operator', 'Memulai produksi', 'operator', 'start', {orderId}, r => assert.equal(r.body.orders.find(o => o.id === orderId).status, 'Dalam produksi'));
await reject('N-32', 'Operator', 'Memulai produksi dua kali', 'operator', 'start', {orderId}, /antrean/);
await reject('N-33', 'Operator', 'Pemeriksaan tanpa catatan', 'operator', 'qc', {orderId, pass: true, note: ''}, /wajib/);
await accept('P-15', 'Operator', 'Pemeriksaan: hasil belum sesuai (Perbaikan)', 'operator', 'qc', {orderId, pass: false, note: 'Warna belum sesuai'}, r => assert.equal(r.body.orders.find(o => o.id === orderId).status, 'Perbaikan'));
await reject('N-34', 'Front Office', 'FO menetapkan siap diambil saat hasil belum lolos', 'fo', 'ready', {orderId}, /lolos/);
await accept('P-16', 'Operator', 'Mulai perbaikan', 'operator', 'start', {orderId});
await accept('P-17', 'Operator', 'Pemeriksaan ulang: sesuai (Lolos pemeriksaan)', 'operator', 'qc', {orderId, pass: true, note: 'Warna dan ukuran sesuai'}, r => assert.equal(r.body.orders.find(o => o.id === orderId).status, 'Lolos pemeriksaan'));
await reject('N-35', 'Operator', 'Operator menetapkan siap diambil', 'operator', 'ready', {orderId}, /peran/);

// ---------- Front Office: pengambilan dan penyerahan ----------
await reject('N-36', 'Front Office', 'Mencatat pemberitahuan sebelum status siap diambil', 'fo', 'notify', {orderId, channel: 'Telepon'}, /siap diambil/);
await reject('N-37', 'Front Office', 'Penyerahan sebelum status siap diambil', 'fo', 'handover', {orderId, recipient: 'Alya'}, /siap/);
await accept('P-18', 'Front Office', 'Menetapkan status siap diambil', 'fo', 'ready', {orderId}, r => assert.equal(r.body.orders.find(o => o.id === orderId).status, 'Siap diambil'));
await check('P-19', 'Pelanggan', 'Pelanggan melihat status Siap diambil dan sisa tagihan 60.000', 'Status dan tagihan sesuai', async () => { const o = await order('c1'); assert.equal(o.status, 'Siap diambil'); assert.equal(o.total - o.payments.reduce((n, p) => n + p.amount, 0), 60000); });
await reject('N-38', 'Front Office', 'Saluran pemberitahuan tidak valid', 'fo', 'notify', {orderId, channel: 'Surat'}, /saluran/);
await reject('N-39', 'Operator', 'Operator mencatat pemberitahuan', 'operator', 'notify', {orderId, channel: 'Telepon'}, /peran/);
await accept('P-20', 'Front Office', 'Mencatat pemberitahuan ke pelanggan (WhatsApp)', 'fo', 'notify', {orderId, channel: 'WhatsApp', note: 'Sudah dikabari'});
await reject('N-40', 'Front Office', 'Penyerahan saat tagihan belum lunas', 'fo', 'handover', {orderId, recipient: 'Alya'}, /lunas/);
await reject('N-41', 'Operator', 'Operator mencatat penyerahan', 'operator', 'handover', {orderId, recipient: 'Alya'}, /peran/);
await accept('P-21', 'Front Office', 'Mencatat pelunasan 60.000 (QRIS)', 'fo', 'pay', {orderId, amount: 60000, method: 'QRIS'});
await reject('N-42', 'Front Office', 'Penyerahan tanpa nama penerima', 'fo', 'handover', {orderId, recipient: ''}, /wajib/);
await accept('P-22', 'Front Office', 'Mencatat penyerahan kepada penerima', 'fo', 'handover', {orderId, recipient: 'Alya Putri'}, r => assert.equal(r.body.orders.find(o => o.id === orderId).status, 'Selesai'));

// ---------- Setelah selesai dan keamanan umum ----------
await reject('N-43', 'Front Office', 'Mengubah pesanan yang sudah Selesai (pembayaran)', 'fo', 'pay', {orderId, amount: 1000, method: 'Tunai'}, /selesai/);
await reject('N-44', 'Pelanggan', 'Meminta revisi pada pesanan Selesai', 'c1', 'revision', {orderId, note: 'x'}, /selesai/);
await reject('N-45', 'Front Office', 'Aksi tidak dikenal pada pesanan aktif', 'fo', 'hapus', {orderId: spareId}, /tidak dikenal/);
await check('N-46', 'Front Office', 'Aksi dengan nomor revisi usang', 'Ditolak (HTTP 409)', async () => { const r = await call('fo', 'customer', {name: 'X', phone: '08123'}, {revision: revision - 1}); assert.equal(r.status, 409); });
await check('N-47', 'Sistem', 'Permintaan lintas asal (Origin berbeda)', 'Ditolak (HTTP 403)', async () => { const r = await call('fo', 'customer', {name: 'X', phone: '08123'}, {headers: {Origin: 'https://situs-lain.example'}, track: false}); assert.equal(r.status, 403); });
// ---------- Berkas: penyimpanan di server (MySQL + disk), unggah/unduh ----------
const att = (await order('c1')).attachments[0];
await check('P-24', 'Pelanggan', 'Berkas pendukung dapat diunduh dari server (inline untuk PNG)', 'HTTP 200, image/png, nosniff', async () => {
  const r = await S.c1.fetch(att.file); assert.equal(r.status, 200); assert.equal(r.headers.get('content-type'), 'image/png');
  assert.equal(r.headers.get('x-content-type-options'), 'nosniff'); assert.match(r.headers.get('content-disposition'), /^inline/); assert.deepEqual(Buffer.from(await r.arrayBuffer()), PNG);
});
await check('P-25', 'Tim Desain', 'Berkas ZIP diterima dan diunduh sebagai lampiran (bukan inline)', 'HTTP 201 lalu attachment', async () => {
  const id = await fileId('design', 'paket-desain.zip', ZIP); const r = await S.design.fetch('/api/files/' + id); assert.equal(r.status, 200); assert.match(r.headers.get('content-disposition'), /^attachment/);
});
await check('N-48', 'Pelanggan', 'Berkas yang sudah terpasang pada pesanan tidak dapat dipakai ulang', 'Ditolak (HTTP 400)', async () => {
  const r = await call('c1', 'create', {title: 'Pakai ulang', spec: 'Y', qty: 1, file: att.file.split('/').pop(), fileName: 'logo.png'}, {track: false}); assert.equal(r.status, 400); assert.match(r.body.error, /sudah dipakai/);
});
await check('N-49', 'Pelanggan', 'Berkas milik pengguna lain (c2) tidak dapat dipasang oleh c1', 'Ditolak (HTTP 400)', async () => {
  const id = await fileId('c2', 'milik-c2.png'); const r = await call('c1', 'create', {title: 'Curi berkas', spec: 'Y', qty: 1, file: id, fileName: 'milik-c2.png'}, {track: false}); assert.equal(r.status, 400);
});
await check('N-50', 'Pelanggan', 'Isi berkas tidak sesuai ekstensi (teks bernama .png)', 'Ditolak (HTTP 415)', async () => { const r = await upload('c1', 'palsu.png', Buffer.from('ini bukan gambar')); assert.equal(r.status, 415); });
await check('N-51', 'Pelanggan', 'Unggah berkas kosong', 'Ditolak (HTTP 400)', async () => { const r = await upload('c1', 'kosong.png', Buffer.alloc(0)); assert.equal(r.status, 400); });
await check('N-52', 'Sistem', 'Unduh berkas dengan id tidak ada', 'HTTP 404', async () => { assert.equal((await S.c1.fetch('/api/files/' + FAKE)).status, 404); });
await check('N-53', 'Sistem', 'Unggah tanpa login ditolak', 'Ditolak (HTTP 401)', async () => { const anon = new (S.c1.constructor)(base); const r = await anon.upload('a.png', PNG); assert.equal(r.status, 401); });
await check('N-54', 'Sistem', 'Nama berkas berisi path traversal dibersihkan', 'Nama tersimpan tanpa path', async () => { const r = await upload('c1', '../../etc/passwd.png', PNG); assert.equal(r.status, 201); assert.equal(r.body.name, 'passwd.png'); });

// ---------- Autentikasi, otorisasi, dan Admin ----------
const anon = () => new (S.c1.constructor)(base);
async function viaAdmin(role, name, password) { const username = 'tmp.' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); const r = await S.admin.json('/api/admin', {action: 'user.create', data: {username, password, name, phone: '081200000001', role}}); assert.equal(r.status, 200, JSON.stringify(r.body)); const s = anon(); assert.equal((await s.login(username, password)).status, 200); return {s, username}; }
await check('N-56', 'Sistem', 'State tanpa login ditolak', 'HTTP 401', async () => { assert.equal((await anon().json('/api/state')).status, 401); });
await check('N-57', 'Sistem', 'Parameter ?user= tidak dapat menyamar sebagai FO', 'Tetap sebagai c1', async () => { const r = await S.c1.json('/api/state?user=' + ID.fo); assert.equal(r.status, 200); assert.equal(r.body.user.id, ID.c1); });
await check('N-58', 'Sistem', 'Login dengan kata sandi salah', 'HTTP 401', async () => { const r = await anon().login('fo.tidak-ada', 'salah-salah'); assert.equal(r.status, 401); assert.match(r.body.error, /salah/); });
await check('N-59', 'Sistem', 'Pesan galat login sama untuk username tidak ada dan sandi salah', 'Pesan identik', async () => { const a = await anon().login('admin', 'salah-salah-1'); const b = await anon().login('tidak.ada.x', 'salah-salah-1'); assert.equal(a.body.error, b.body.error); });
await check('N-60', 'Sistem', 'Pembatas percobaan login (8 gagal)', 'HTTP 429', async () => { const s = anon(); let last = 0; for (let i = 0; i < 10; i++) last = (await s.login('korban.throttle', 'salah-salah-' + i)).status; assert.equal(last, 429); });
await check('N-61', 'Pelanggan', 'Pelanggan membuka API Admin', 'HTTP 403', async () => { assert.equal((await S.c1.json('/api/admin')).status, 403); });
await check('N-62', 'Front Office', 'FO membuat pengguna lewat API Admin', 'HTTP 403', async () => { assert.equal((await S.fo.json('/api/admin', {action: 'user.create', data: {}})).status, 403); });
await check('N-63', 'Sistem', 'Pendaftaran mandiri tidak tersedia', 'Bukan HTTP 2xx', async () => { const r = await anon().json('/api/auth/register', {username: 'reg.' + Date.now().toString(36), password: 'Sandi-uji-12345', name: 'Daftar Mandiri', phone: '081200000000', role: 'admin'}); assert.ok(r.status >= 400, 'status ' + r.status); });
await check('N-64', 'Admin', 'Akun dengan kata sandi pendek ditolak', 'HTTP 400', async () => { assert.equal((await S.admin.json('/api/admin', {action: 'user.create', data: {username: 'pendek.x1', password: '123', name: 'X', role: 'customer'}})).status, 400); });
await check('N-65', 'Admin', 'Username ganda ditolak', 'HTTP 409', async () => { const r = await S.admin.json('/api/admin', {action: 'user.create', data: {username: S.fo.user.username, password: 'Sandi-uji-12345', name: 'Ganda', role: 'fo'}}); assert.equal(r.status, 409); });
await check('N-66', 'Admin', 'Admin tidak dapat menonaktifkan akunnya sendiri', 'Ditolak (HTTP 400)', async () => { const r = await S.admin.json('/api/admin', {action: 'user.update', data: {id: ID.admin, name: 'Admin', phone: '', role: 'admin', active: false}}); assert.equal(r.status, 400); });
await check('N-67', 'Admin', 'Admin tidak dapat mengubah peran sendiri', 'Ditolak (HTTP 400)', async () => { const r = await S.admin.json('/api/admin', {action: 'user.update', data: {id: ID.admin, name: 'Admin', phone: '', role: 'fo', active: true}}); assert.equal(r.status, 400); });
await check('N-68', 'Admin', 'Peran pengguna yang terkait pesanan tidak dapat diubah', 'Ditolak (HTTP 400)', async () => { const r = await S.admin.json('/api/admin', {action: 'user.update', data: {id: ID.c1, name: 'Alya Putri', phone: '081', role: 'fo', active: true}}); assert.equal(r.status, 400); });
await check('N-118', 'Admin', 'Metode pembayaran dan saluran bawaan tidak dapat dihapus', 'HTTP 400, daftar tetap', async () => {
  for (const [a, name] of [['method.delete', 'Tunai'], ['method.delete', 'QRIS'], ['channel.delete', 'WhatsApp']]) assert.equal((await S.admin.json('/api/admin', {action: a, data: {name}})).status, 400, a + ' ' + name);
  const o = (await S.admin.json('/api/admin')).body;
  assert.ok(['Tunai', 'Transfer', 'QRIS'].every(n => o.methods.some(m => m.name === n)) && ['Telepon', 'WhatsApp', 'Tatap muka'].every(n => o.channels.some(m => m.name === n)));
});
await check('N-119', 'Admin', 'Email pengguna dapat diisi, diubah, dan divalidasi', 'Tersimpan; format salah HTTP 400', async () => {
  const row = (await S.admin.json('/api/admin')).body.users.find(u => u.id === ID.c2);
  const set = (email) => S.admin.json('/api/admin', {action: 'user.update', data: {id: row.id, name: row.name, phone: row.phone, role: row.role, active: true, email}});
  assert.equal((await set('bukan-email')).status, 400);
  const ok = await set('Bima.Uji@Yopmail.com'); assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.equal(ok.body.users.find(u => u.id === ID.c2).email, 'bima.uji@yopmail.com');
  assert.equal((await set('')).body.users.find(u => u.id === ID.c2).email, '');
});
await check('N-69', 'Admin', 'Metode pembayaran terakhir tidak dapat dinonaktifkan', 'Ditolak (HTTP 400)', async () => {
  const ov = (await S.admin.json('/api/admin')).body; const act = ov.methods.filter(m => m.active);
  for (const m of act.slice(0, -1)) assert.equal((await S.admin.json('/api/admin', {action: 'method.toggle', data: {name: m.name, active: false}})).status, 200);
  const r = await S.admin.json('/api/admin', {action: 'method.toggle', data: {name: act.at(-1).name, active: false}});
  for (const m of act.slice(0, -1)) await S.admin.json('/api/admin', {action: 'method.toggle', data: {name: m.name, active: true}});
  assert.equal(r.status, 400);
});
await check('P-27', 'Admin', 'Katalog: tambah produk lalu tampil di etalase publik', 'Produk terlihat', async () => {
  const name = 'Produk Uji ' + Date.now().toString(36);
  const r = await S.admin.json('/api/admin', {action: 'catalog.save', data: {name, category: 'Uji', description: 'Deskripsi uji', hint: 'Isi ukuran', sample: 'UJI', style: 'poster'}}); assert.equal(r.status, 200, JSON.stringify(r.body));
  const pub = await anon().json('/api/katalog'); assert.ok(pub.body.items.some(p => p.name === name));
  const row = r.body.catalog.find(p => p.name === name);
  assert.equal((await S.admin.json('/api/admin', {action: 'catalog.save', data: {...row, active: false}})).status, 200);
  assert.ok(!(await anon().json('/api/katalog')).body.items.some(p => p.name === name));
  assert.equal((await S.admin.json('/api/admin', {action: 'catalog.delete', data: {id: row.id}})).status, 200);
});
await check('P-28', 'Admin', 'Metode pembayaran baru dapat dipakai FO; yang dinonaktifkan ditolak', 'Diterima lalu ditolak', async () => {
  const n = 'Dompet' + Date.now().toString(36).slice(-4);
  assert.equal((await S.admin.json('/api/admin', {action: 'method.add', data: {name: n}})).status, 200);
  assert.equal((await S.fo.json('/api/state', {action: 'customer', data: {name: 'Tamu Uji', phone: '08123456'}, revision: (await view('fo')).revision})).status, 200);
  assert.equal((await S.admin.json('/api/admin', {action: 'method.toggle', data: {name: n, active: false}})).status, 200);
  assert.equal((await S.admin.json('/api/admin', {action: 'method.delete', data: {name: n}})).status, 200);
  const st = (await S.fo.json('/api/state')).body; assert.ok(!st.master.methods.includes(n));
});
await check('P-29', 'Admin', 'Nonaktifkan pengguna: sesi berakhir dan login ditolak', 'HTTP 401 setelahnya', async () => {
  const u = await S.admin.json('/api/admin', {action: 'user.create', data: {username: 'tmp.' + Date.now().toString(36), password: 'Sandi-uji-12345', name: 'Sementara', role: 'operator'}}); assert.equal(u.status, 200);
  const row = u.body.users.find(x => x.name === 'Sementara' && x.active);
  const s = anon(); const username = row.username; assert.equal((await s.login(username, 'Sandi-uji-12345')).status, 200);
  assert.equal((await S.admin.json('/api/admin', {action: 'user.update', data: {id: row.id, name: row.name, phone: '', role: 'operator', active: false}})).status, 200);
  assert.equal((await s.json('/api/state')).status, 401);
  assert.equal((await anon().login(username, 'Sandi-uji-12345')).status, 401);
});
await check('P-30', 'Semua aktor', 'Ubah kata sandi sendiri; sandi lama tidak berlaku, sandi baru berlaku', 'Login dengan sandi baru', async () => {
  const {s, username} = await viaAdmin('customer', 'Ganti Sandi', 'Sandi-lama-123');
  assert.equal((await s.json('/api/auth/password', {current: 'salah-banget', next: 'Sandi-baru-456'})).status, 403);
  assert.equal((await s.json('/api/auth/password', {current: 'Sandi-lama-123', next: 'Sandi-baru-456'})).status, 200);
  assert.equal((await anon().login(username, 'Sandi-lama-123')).status, 401);
  assert.equal((await anon().login(username, 'Sandi-baru-456')).status, 200);
});
await check('P-31', 'Semua aktor', 'Keluar mengakhiri sesi', 'HTTP 401 setelah keluar', async () => {
  const {s} = await viaAdmin('customer', 'Keluar Uji', 'Sandi-keluar-12');
  const saved = s.cookie; assert.equal((await s.json('/api/auth/logout', {})).status, 200);
  const replay = anon(); replay.cookie = saved; assert.equal((await replay.json('/api/state')).status, 401);
});
await check('N-70', 'Pelanggan', 'Berkas milik pesanan orang lain tidak dapat diunduh', 'HTTP 404', async () => { const r = await S.c2.fetch(att.file); assert.equal(r.status, 404); });

// ---------- Pembayaran pelanggan: QRIS (simulasi), transfer, tunai ----------
const payOrder = async () => (await S.fo.json('/api/state')).body.orders.find(o => o.id === spareId);
const mkReq = (who, body) => S[who].json('/api/bayar', {action: 'create', ...body});
await check('N-71', 'Pelanggan', 'Meminta pembayaran untuk pesanan yang belum diverifikasi', 'HTTP 400', async () => { assert.equal((await mkReq('c2', {orderId: spareId, method: 'QRIS', amount: 1000})).status, 400); });
await check('P-32', 'Front Office', 'Memverifikasi pesanan c2 (total 50.000, DP 20.000)', 'HTTP 200', async () => {
  const rev = (await S.fo.json('/api/state')).body.revision;
  const r = await S.fo.json('/api/state', {action: 'verify', data: {orderId: spareId, total: 50000, dp: 20000, due: '2026-12-30', designerId: ID.design, operatorId: ID.operator}, revision: rev}); assert.equal(r.status, 200, JSON.stringify(r.body));
});
await check('N-72', 'Pelanggan', 'Nominal melebihi sisa tagihan', 'HTTP 400', async () => { assert.equal((await mkReq('c2', {orderId: spareId, method: 'QRIS', amount: 50001})).status, 400); });
await check('N-73', 'Pelanggan', 'Pelanggan lain (c1) meminta pembayaran untuk pesanan c2', 'HTTP 404', async () => { assert.equal((await mkReq('c1', {orderId: spareId, method: 'QRIS', amount: 1000})).status, 404); });
await check('N-74', 'Pelanggan', 'Metode di luar master ditolak', 'HTTP 400', async () => { assert.equal((await mkReq('c2', {orderId: spareId, method: 'Kripto', amount: 1000})).status, 400); });
let qrId = '';
await check('P-33', 'Pelanggan', 'Membuat permintaan pembayaran QRIS untuk DP 20.000', 'Permintaan pending', async () => { const r = await mkReq('c2', {orderId: spareId, method: 'QRIS', amount: 20000}); assert.equal(r.status, 200, JSON.stringify(r.body)); qrId = r.body.id; assert.ok(r.body.requests.some(x => x.id === qrId && x.status === 'pending' && x.kind === 'qr')); });
await check('P-34', 'Pelanggan', 'Kode QR berupa SVG dan hanya dapat dilihat pemilik', 'Pemilik 200 image/svg+xml; lainnya 404', async () => {
  const r = await S.c2.fetch('/api/bayar/qr?id=' + qrId); assert.equal(r.status, 200); assert.match(r.headers.get('content-type'), /image\/svg\+xml/); assert.match(await r.text(), /<svg/);
  assert.equal((await S.c1.fetch('/api/bayar/qr?id=' + qrId)).status, 404); assert.equal((await anon().fetch('/api/bayar/qr?id=' + qrId)).status, 401);
});
await check('N-75', 'Sistem', 'Halaman demo dengan token tidak dikenal', 'HTTP 404', async () => { assert.equal((await anon().json('/api/bayar/demo?id=' + '0'.repeat(32))).status, 404); assert.equal((await anon().json('/api/bayar/demo?id=abc')).status, 404); });
await check('N-76', 'Front Office', 'FO tidak dapat mengonfirmasi QRIS secara manual', 'HTTP 400', async () => { assert.equal((await S.fo.json('/api/bayar', {action: 'confirm', id: qrId})).status, 400); });
await check('P-35', 'Pelanggan', 'Memindai QR: halaman demo menampilkan tagihan, lalu pembayaran berhasil dan tercatat sebagai DP', 'Payments +1 (DP, QRIS)', async () => {
  const info = await anon().json('/api/bayar/demo?id=' + qrId); assert.equal(info.status, 200); assert.equal(info.body.status, 'pending'); assert.equal(info.body.amount, 20000);
  const pay = await anon().json('/api/bayar/demo', {id: qrId}); assert.equal(pay.status, 200, JSON.stringify(pay.body)); assert.equal(pay.body.status, 'paid');
  const o = await payOrder(); assert.equal(o.payments.length, 1); assert.equal(o.payments[0].kind, 'DP'); assert.equal(o.payments[0].method, 'QRIS'); assert.equal(o.payments[0].amount, 20000);
});
await check('N-77', 'Sistem', 'QR yang sudah dibayar tidak dapat dibayar dua kali', 'HTTP 409', async () => { assert.equal((await anon().json('/api/bayar/demo', {id: qrId})).status, 409); assert.equal((await payOrder()).payments.length, 1); });
let trfId = '';
await check('P-36', 'Pelanggan', 'Permintaan transfer 30.000 (pelunasan) menunggu konfirmasi FO', 'Pending dan terlihat FO', async () => {
  const r = await mkReq('c2', {orderId: spareId, method: 'Transfer', amount: 30000}); assert.equal(r.status, 200, JSON.stringify(r.body)); trfId = r.body.id; assert.equal(r.body.bank.holder.length > 0, true);
  const fo = await S.fo.json('/api/bayar'); assert.ok(fo.body.requests.some(x => x.id === trfId));
});
await check('N-78', 'Sistem', 'Token transfer tidak dapat dibayar lewat halaman QR demo', 'HTTP 400', async () => { assert.equal((await anon().json('/api/bayar/demo', {id: trfId})).status, 400); });
await check('N-79', 'Pelanggan', 'Pelanggan tidak dapat mengonfirmasi pembayarannya sendiri', 'HTTP 403', async () => { assert.equal((await S.c2.json('/api/bayar', {action: 'confirm', id: trfId})).status, 403); });
await check('P-37', 'Front Office', 'FO mengonfirmasi transfer: pesanan lunas', 'Payments 2, total 50.000', async () => {
  const r = await S.fo.json('/api/bayar', {action: 'confirm', id: trfId}); assert.equal(r.status, 200, JSON.stringify(r.body));
  const o = await payOrder(); assert.equal(o.payments.length, 2); assert.equal(o.payments.reduce((n, p) => n + p.amount, 0), 50000); assert.equal(o.payments[1].kind, 'Pelunasan');
});
await check('N-80', 'Pelanggan', 'Meminta pembayaran untuk pesanan yang sudah lunas', 'HTTP 400', async () => { assert.equal((await mkReq('c2', {orderId: spareId, method: 'Tunai', amount: 1000})).status, 400); });
await check('N-81', 'Front Office', 'Konfirmasi ulang permintaan yang sudah dibayar', 'HTTP 409', async () => { assert.equal((await S.fo.json('/api/bayar', {action: 'confirm', id: trfId})).status, 409); });
await check('P-23', 'Semua aktor', 'Hasil akhir: Selesai, lunas 100.000, 2 versi desain, 1 revisi, 1 kendala, 1 pemberitahuan, 1 berkas', 'Nilai sesuai', async () => {
  const o = await order('fo'); assert.equal(o.status, 'Selesai'); assert.equal(o.payments.reduce((n, p) => n + p.amount, 0), 100000);
  assert.equal(o.designs.length, 2); assert.equal(o.revisions.length, 1); assert.equal(o.issues.length, 1); assert.equal(o.notifications.length, 1); assert.equal(o.attachments.length, 1); assert.equal(o.recipient, 'Alya Putri');
  assert.deepEqual(o.payments.map(p => p.kind), ['DP', 'DP', 'Pelunasan']);
});

// ---------- Pemesanan publik tanpa login: akun otomatis ----------
const rnd = () => String(Math.floor(Math.random() * 9e7) + 1e7);
const mkPhone = () => '0857' + rnd();
const guestBody = (over = {}) => ({name: 'Tamu Uji', phone: mkPhone(), product: 'Banner & Spanduk', spec: 'Banner 3 x 1 m', qty: 2, mode: 'desain', requestId: crypto.randomUUID(), website: '', ...over});
let ipSeq = 10;
const nextIp = () => '198.51.100.' + (ipSeq++);
async function guestPost(body, ip = nextIp()) {
  const s = new Session(base);
  const r = await s.fetch('/api/pesan', {method: 'POST', headers: {'Content-Type': 'application/json', 'X-Forwarded-For': ip}, body: JSON.stringify(body)});
  return {s, status: r.status, body: await r.json().catch(() => ({}))};
}
let G = null;
await check('P-30', 'Pengunjung', 'Memesan tanpa login: akun Pelanggan dibuat otomatis dan sesi terbuka', 'HTTP 201 + username/sandi + pesanan tampil', async () => {
  G = await guestPost(guestBody({mode: 'cetak', email: 'tamu.uji@example.com'}));
  assert.equal(G.status, 201, JSON.stringify(G.body));
  assert.match(G.body.username, /^[a-z0-9]{2,12}\d{4}$/); assert.equal(G.body.password.length, 10); assert.match(G.body.orderId, /^RPT-\d+$/);
  const v = await G.s.json('/api/state'); assert.equal(v.status, 200);
  assert.equal(v.body.user.role, 'customer'); assert.equal(v.body.user.mustChange, true);
  const o = v.body.orders.find(x => x.id === G.body.orderId); assert.equal(o.status, 'Menunggu verifikasi'); assert.equal(o.mode, 'cetak'); assert.equal(o.title, 'Banner & Spanduk');
});
await check('P-31', 'Pengunjung', 'Berkas diunggah dan dilampirkan ke pesanan setelah akun dibuat', 'HTTP 200, 1 lampiran', async () => {
  const up = await G.s.upload('desain.png', PNG); assert.equal(up.status, 201, JSON.stringify(up.body));
  const r = await G.s.json('/api/pengunjung', {action: 'attach', orderId: G.body.orderId, file: up.body.id, fileName: 'desain.png'}); assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.orders.find(o => o.id === G.body.orderId).attachments.length, 1);
});
await check('P-32', 'Pengunjung', 'Akun otomatis wajib ganti kata sandi: aksi diblokir sampai diganti', 'HTTP 403 lalu 200', async () => {
  const blocked = await G.s.json('/api/state', {action: 'create', data: {title: 'X', spec: 'Y', qty: 1}, revision: 0}); assert.equal(blocked.status, 403); assert.match(blocked.body.error, /kata sandi/i);
  const ch = await G.s.json('/api/auth/password', {current: G.body.password, next: 'Sandi-Baru-12345'}); assert.equal(ch.status, 200, JSON.stringify(ch.body));
  const v = await G.s.json('/api/state'); assert.ok(!v.body.user.mustChange);
});
await check('P-33', 'Pengunjung', 'Masuk kembali dengan akun otomatis setelah sandi diganti', 'HTTP 200; sandi sementara ditolak', async () => {
  const s = new Session(base); assert.equal((await s.login(G.body.username, 'Sandi-Baru-12345')).status, 200);
  assert.equal((await new Session(base).login(G.body.username, G.body.password)).status, 401);
});
await check('P-34', 'Pengunjung', 'Memesan hanya dengan email', 'HTTP 201', async () => {
  const g = await guestPost(guestBody({phone: '', email: 'hanya.email.' + rnd() + '@example.com'})); assert.equal(g.status, 201, JSON.stringify(g.body));
});
await check('P-35', 'Pengunjung', 'Pelanggan ber-login memesan ulang dengan opsi desain dulu', 'HTTP 200, mode desain', async () => {
  const r = await G.s.json('/api/pengunjung', {action: 'create', requestId: crypto.randomUUID(), title: 'Kartu Nama', spec: 'Kartu 2 sisi', qty: 100, mode: 'desain'}); assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.orders.find(o => o.id === r.body.orderId).mode, 'desain');
});
const rejectGuest = (id, title, over, status, pattern) => check(id, 'Pengunjung', title, 'Ditolak (HTTP ' + status + ')', async () => { const g = await guestPost(guestBody(over)); assert.equal(g.status, status, JSON.stringify(g.body)); if (pattern) assert.match(g.body.error || '', pattern); });
await rejectGuest('N-90', 'Telepon sudah terdaftar (format berbeda) ditolak, tidak menumpang ke akun lain', {phone: '+62 812-3456-7890'}, 409, /sudah terdaftar/);
await rejectGuest('N-91', 'Tanpa telepon dan email', {phone: '', email: ''}, 400, /telepon atau email/i);
await rejectGuest('N-92', 'Nomor telepon tidak valid', {phone: '12345'}, 400, /telepon/i);
await rejectGuest('N-93', 'Email tidak valid', {phone: '', email: 'bukan-email'}, 400, /email/i);
await rejectGuest('N-94', 'Produk di luar katalog', {product: 'Produk Siluman'}, 400, /tipe pesanan/i);
await rejectGuest('N-95', 'Bot mengisi kolom jebakan', {website: 'http://spam.example'}, 400);
await rejectGuest('N-96', 'Opsi pengerjaan tidak dipilih', {mode: ''}, 400, /opsi/i);
await rejectGuest('N-97', 'Jumlah cetak 0', {qty: 0}, 400, /tidak valid/);
await rejectGuest('N-98', 'Nama kosong', {name: ' '}, 400, /nama/i);
await check('N-99', 'Pengunjung', 'Pelanggan lain tidak dapat melampirkan berkas ke pesanan orang lain', 'HTTP 404', async () => {
  const up = await S.c2.upload('x.png', PNG); const r = await S.c2.json('/api/pengunjung', {action: 'attach', orderId: G.body.orderId, file: up.body.id, fileName: 'x.png'}); assert.equal(r.status, 404);
});
await check('N-100', 'Pengunjung', 'Pembatas laju per identitas: percobaan ke-4 dengan telepon sama', 'HTTP 429', async () => {
  const phone = mkPhone(); const codes = [];
  for (let i = 0; i < 4; i++) codes.push((await guestPost(guestBody({phone}))).status);
  assert.deepEqual(codes, [201, 409, 409, 429]);
});
await check('N-101', 'Pengunjung', 'Pembatas laju per IP: permintaan ke-7 dari IP yang sama', 'HTTP 429', async () => {
  const ip = nextIp(); const codes = [];
  for (let i = 0; i < 7; i++) codes.push((await guestPost(guestBody(), ip)).status);
  assert.deepEqual(codes, [201, 201, 201, 201, 201, 201, 429]);
});
await check('N-102', 'Sistem', 'Pesanan publik dari origin lain ditolak', 'HTTP 403', async () => {
  const r = await fetch(base + '/api/pesan', {method: 'POST', headers: {'Content-Type': 'application/json', Origin: 'http://evil.example'}, body: JSON.stringify(guestBody())}); assert.equal(r.status, 403);
});

// ---------- Pengaturan pengiriman (WAHA + SMTP) dengan server tiruan ----------
const waLog = [], mailLog = [];
const wahaMock = http.createServer((req, res) => { let b = ''; req.on('data', d => b += d); req.on('end', () => { waLog.push({url: req.url, key: req.headers['x-api-key'], body: JSON.parse(b || '{}')}); res.setHeader('Content-Type', 'application/json'); res.end('{"ok":true}'); }); });
const smtpMock = net.createServer(sock => {
  let data = '', inData = false; sock.write('220 mock ESMTP\r\n');
  sock.on('data', chunk => {
    for (const line of chunk.toString('latin1').split(/(?<=\r\n)/)) {
      if (inData) { data += line; if (data.endsWith('\r\n.\r\n')) { inData = false; mailLog.push(data); sock.write('250 queued\r\n'); } continue; }
      const cmd = line.trim().toUpperCase();
      if (cmd.startsWith('EHLO') || cmd.startsWith('HELO')) sock.write('250 mock\r\n');
      else if (cmd.startsWith('MAIL FROM') || cmd.startsWith('RCPT TO')) sock.write('250 OK\r\n');
      else if (cmd === 'DATA') { inData = true; data = ''; sock.write('354 go\r\n'); }
      else if (cmd === 'QUIT') { sock.write('221 bye\r\n'); sock.end(); }
      else if (cmd) sock.write('250 OK\r\n');
    }
  });
});
// MOCK_HOST (mis. host.docker.internal) dipakai bila aplikasi berjalan di Docker dan harus menjangkau server tiruan di komputer ini.
const mockHost = process.env.MOCK_HOST || '127.0.0.1', mockBind = process.env.MOCK_HOST ? '0.0.0.0' : '127.0.0.1';
await new Promise(r => wahaMock.listen(0, mockBind, r)); await new Promise(r => smtpMock.listen(0, mockBind, r));
const wahaUrl = 'http://' + mockHost + ':' + wahaMock.address().port, smtpPort = String(smtpMock.address().port);
const admin = (action, data = {}) => S.admin.json('/api/admin', {action, data});
const cfgOk = {waha_enabled: true, waha_url: wahaUrl, waha_session: 'printora', waha_key: 'kunci-rahasia-waha', smtp_enabled: true, smtp_host: mockHost, smtp_port: smtpPort, smtp_user: '', mail_from: 'Printora <info@contoh.test>', public_url: 'https://printora.contoh.test'};
const waitFor = async (fn, ms = 4000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await new Promise(r => setTimeout(r, 100)); } return false; };

await check('P-40', 'Admin', 'Menyimpan pengaturan WAHA dan SMTP; rahasia tidak pernah dikembalikan', 'HTTP 200; tanpa waha_key', async () => {
  const r = await admin('settings.save', cfgOk); assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.settings.hasWahaKey, true); assert.equal(r.body.settings.waha_url, wahaUrl); assert.equal(r.body.settings.public_url, 'https://printora.contoh.test');
  assert.ok(!('waha_key' in r.body.settings)); assert.ok(!JSON.stringify(r.body).includes('kunci-rahasia-waha'));
});
await check('P-41', 'Admin', 'Uji kirim WhatsApp: server WAHA menerima chatId, sesi, dan API key', 'HTTP 200; chatId 62…@c.us', async () => {
  const r = await admin('settings.test', {channel: 'whatsapp', to: '081234567890'}); assert.equal(r.status, 200, JSON.stringify(r.body));
  const m = waLog.at(-1); assert.equal(m.url, '/api/sendText'); assert.equal(m.key, 'kunci-rahasia-waha'); assert.equal(m.body.chatId, '6281234567890@c.us'); assert.equal(m.body.session, 'printora');
});
await check('P-42', 'Admin', 'Uji kirim email lewat SMTP', 'HTTP 200; email diterima server SMTP', async () => {
  const r = await admin('settings.test', {channel: 'email', to: 'uji@contoh.test'}); assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.ok(await waitFor(() => mailLog.length >= 1)); assert.match(mailLog.at(-1), /Subject: Uji pengiriman Printora/);
});
let sent = null;
// Email mentah memakai quoted-printable (baris dipatah dengan '='); klien email mendekodenya, tes juga.
const qp = (m) => String(m).replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
await check('P-43', 'Pengunjung', 'Pesan publik mengirim info pesanan dan akses ke WhatsApp dan email', 'sentTo = whatsapp, email; isi memuat username dan sandi', async () => {
  const waBefore = waLog.length, mailBefore = mailLog.length;
  const g = await guestPost(guestBody({email: 'pelanggan.baru.' + rnd() + '@contoh.test'})); assert.equal(g.status, 201, JSON.stringify(g.body)); sent = g.body;
  assert.deepEqual(g.body.sentTo.sort(), ['email', 'whatsapp']);
  assert.ok(await waitFor(() => waLog.length > waBefore && mailLog.length > mailBefore));
  // Pesan akses masuk adalah satu-satunya yang memuat kata sandi sementara; pesan ke FO (pesanan baru) juga terkirim.
  const wa = waLog.findLast(m => m.body.text.includes('Kata sandi sementara')).body.text, em = qp(mailLog.findLast(m => m.includes('Subject: Pesanan') && qp(m).includes(g.body.password)));
  assert.ok(em && wa);
  for (const t of [wa, em]) { assert.ok(t.includes(g.body.orderId)); assert.ok(t.includes(g.body.username)); assert.ok(t.includes(g.body.password)); assert.ok(t.includes('https://printora.contoh.test/operasional')); }
  assert.match(em, /Subject: Pesanan RPT-\d+ diterima/); assert.match(em, /Content-Type: text\/html/, 'email berbentuk HTML');
});
await check('P-44', 'Admin', 'Riwayat pengiriman tercatat tanpa kata sandi atau isi pesan', 'Entri TERKIRIM; tanpa sandi', async () => {
  const r = await S.admin.json('/api/admin'); const text = JSON.stringify(r.body.messages);
  assert.ok(r.body.messages.some(m => m.kind === 'pesanan-baru' && m.channel === 'whatsapp' && m.ok)); assert.ok(r.body.messages.some(m => m.kind === 'pesanan-baru' && m.channel === 'email' && m.ok));
  assert.ok(!text.includes(sent.password)); assert.ok(!text.includes(sent.username)); assert.ok(!text.includes('0857'));
});
await check('P-45', 'Admin', 'Mengosongkan API key saat menyimpan tidak mengubah nilai tersimpan', 'Uji kirim tetap memakai key lama', async () => {
  const r = await admin('settings.save', {...cfgOk, waha_key: ''}); assert.equal(r.status, 200); assert.equal(r.body.settings.hasWahaKey, true);
  assert.equal((await admin('settings.test', {channel: 'whatsapp', to: '081234567890'})).status, 200); assert.equal(waLog.at(-1).key, 'kunci-rahasia-waha');
});
await check('P-47', 'Pelanggan', 'Notifikasi status ke WhatsApp dan email: verifikasi, desain siap ditinjau, pembayaran (sisa dan lunas)', 'Tiap perubahan menghasilkan 1 pesan; aksi pelanggan sendiri tidak', async () => {
  const oid = sent.orderId; const step = async (user, action, data, expectText) => {
    await view(user); const w0 = waLog.length, m0 = mailLog.length; const r = await call(user, action, {orderId: oid, ...data}); assert.equal(r.status, 200, action + ' ' + JSON.stringify(r.body));
    if (expectText === null) { await new Promise(r => setTimeout(r, 500)); assert.equal(waLog.length, w0, action + ' tidak boleh memicu pesan'); return; }
    assert.ok(await waitFor(() => waLog.length > w0 && mailLog.length > m0), action + ' tidak mengirim pesan'); const t = waLog.at(-1).body.text;
    assert.ok(t.includes(oid) && t.includes(expectText), action + ': ' + t); assert.ok(!t.includes(sent.password)); assert.ok(t.includes('https://printora.contoh.test/operasional'));
  };
  await step('fo', 'verify', {total: 100000, dp: 40000, due: '2026-12-10', designerId: ID.design, operatorId: ID.operator}, 'diverifikasi');
  await step('design', 'upload', {name: 'v1.png', file: await fileId('design', 'v1.png'), note: 'a'}, 'siap Anda tinjau');
  await step('fo', 'pay', {amount: 40000, method: 'Tunai'}, 'Sisa tagihan');
  await step('fo', 'pay', {amount: 60000, method: 'Tunai'}, 'sudah lunas');
});
await check('P-48', 'Pelanggan', 'Desain terlampir di email pelanggan, email berbentuk HTML bermerek, dan petugas mendapat notifikasi sesuai peran', 'Lampiran v1.png; FO tahu pesanan baru; operator tidak menerima berkas yang bukan miliknya', async () => {
  const withFile = mailLog.filter(m => /filename="?v1\.png/.test(m));
  assert.ok(withFile.length >= 1, 'email desain berlampiran');
  const m = withFile.at(-1); assert.match(m, /Content-Type: multipart\/mixed/); assert.match(m, /Content-Type: text\/html/);
  const html = qp(m); assert.ok(html.includes('Desain siap ditinjau') && html.includes('Printora') && html.includes('terlampir'));
  assert.ok(waLog.some(w => w.body.text.includes('Pesanan baru masuk') && w.body.text.includes('*Printora*')), 'FO menerima pesanan baru dengan format WhatsApp');
  assert.ok(waLog.some(w => w.body.text.includes('Tugas desain baru')), 'desainer menerima penugasan');
});
await check('N-110', 'Front Office', 'Non-Admin tidak dapat membaca atau mengubah pengaturan', 'HTTP 403', async () => {
  assert.equal((await S.fo.json('/api/admin', {action: 'settings.save', data: cfgOk})).status, 403); assert.equal((await S.fo.json('/api/admin')).status, 403); assert.equal((await S.c1.json('/api/admin')).status, 403);
});
const badCfg = (id, title, over, pattern) => check(id, 'Admin', title, 'Ditolak (HTTP 400)', async () => { const r = await admin('settings.save', {...cfgOk, ...over}); assert.equal(r.status, 400, JSON.stringify(r.body)); assert.match(r.body.error, pattern); });
await badCfg('N-111', 'Alamat WAHA bukan http/https', {waha_url: 'ftp://host'}, /http/);
await badCfg('N-112', 'Aktifkan WhatsApp tanpa alamat WAHA', {waha_url: ''}, /alamat WAHA/i);
await badCfg('N-113', 'Aktifkan email tanpa alamat pengirim yang valid', {mail_from: 'bukan-email'}, /pengirim/i);
await badCfg('N-114', 'Port SMTP tidak valid', {smtp_port: '99999'}, /port/i);
await check('N-115', 'Admin', 'Uji kirim ke nomor tidak valid dan tanpa tujuan', 'HTTP 502 / 502', async () => {
  const a = await admin('settings.test', {channel: 'whatsapp', to: '123'}); assert.equal(a.status, 502); assert.match(a.body.error, /tidak valid/);
  const b = await admin('settings.test', {channel: 'email', to: 'bukan-email'}); assert.equal(b.status, 502);
});
await check('N-116', 'Admin', 'WAHA tidak dapat dijangkau: uji gagal dengan pesan jelas, pesanan tetap tersimpan', 'Uji HTTP 502; pesanan HTTP 201; riwayat GAGAL', async () => {
  const dead = http.createServer(); await new Promise(r => dead.listen(0, '127.0.0.1', r)); const port = dead.address().port; await new Promise(r => dead.close(r));
  assert.equal((await admin('settings.save', {...cfgOk, waha_url: 'http://127.0.0.1:' + port, smtp_enabled: false})).status, 200);
  const t = await admin('settings.test', {channel: 'whatsapp', to: '081234567890'}); assert.equal(t.status, 502); assert.match(t.body.error, /gagal/i);
  const g = await guestPost(guestBody()); assert.equal(g.status, 201, JSON.stringify(g.body));
  assert.ok(await waitFor(async () => (await S.admin.json('/api/admin')).body.messages.some(m => m.kind === 'pesanan-baru' && !m.ok)));
});
await check('P-46', 'Admin', 'Menonaktifkan saluran: pesanan baru tidak memicu pengiriman', 'sentTo kosong', async () => {
  assert.equal((await admin('settings.save', {...cfgOk, waha_enabled: false, smtp_enabled: false})).status, 200);
  const before = waLog.length + mailLog.length; const g = await guestPost(guestBody({email: 'x' + rnd() + '@contoh.test'})); assert.equal(g.status, 201); assert.deepEqual(g.body.sentTo, []);
  await new Promise(r => setTimeout(r, 400)); assert.equal(waLog.length + mailLog.length, before);
});
await check('N-117', 'Pengunjung', 'Header Host/X-Forwarded-Host palsu tidak masuk ke tautan pesan (anti link-poisoning)', 'Tanpa public_url: pesan tanpa tautan; dengan public_url: tautan resmi', async () => {
  assert.equal((await admin('settings.save', {...cfgOk, smtp_enabled: false, public_url: ''})).status, 200);
  const post = (body) => new Promise((res, rej) => {
    const u = new URL(base + '/api/pesan'); const data = JSON.stringify(body);
    const rq = http.request({host: u.hostname, port: u.port, path: u.pathname, method: 'POST', headers: {Host: 'evil.example', 'X-Forwarded-Host': 'evil.example', 'X-Forwarded-Proto': 'https', 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data)}}, (r) => { let b = ''; r.on('data', d => b += d); r.on('end', () => res({status: r.statusCode, body: JSON.parse(b || '{}')})); });
    rq.on('error', rej); rq.end(data);
  });
  const before = waLog.length; const g = await post(guestBody()); assert.equal(g.status, 201, JSON.stringify(g.body));
  assert.ok(await waitFor(() => waLog.slice(before).some(m => m.body.text.includes('Kata sandi sementara')))); const t = waLog.slice(before).findLast(m => m.body.text.includes('Kata sandi sementara')).body.text;
  assert.ok(!t.includes('evil.example')); assert.ok(!t.includes('http')); assert.ok(t.includes(g.body.password));
  assert.equal((await admin('settings.save', {...cfgOk, smtp_enabled: false})).status, 200);
  const b2 = waLog.length; const g2 = await post(guestBody()); assert.equal(g2.status, 201); assert.ok(await waitFor(() => waLog.slice(b2).some(m => m.body.text.includes('Kata sandi sementara'))));
  const t2 = waLog.slice(b2).findLast(m => m.body.text.includes('Kata sandi sementara')).body.text; assert.ok(!t2.includes('evil.example')); assert.ok(t2.includes('https://printora.contoh.test/operasional'));
});
wahaMock.close(); smtpMock.close();

// Batas 500 MB (opsional karena berat: E2E_BIG=1). Dijalankan terakhir: server menutup koneksi saat menolak unggahan yang melebihi batas.
if (process.env.E2E_BIG) {
  const BIG = Buffer.alloc(500 * 1024 * 1024); BIG.write('PK');
  await check('P-26', 'Pelanggan', 'Unggah berkas tepat 500 MB berhasil', 'HTTP 201, ukuran 500 MB', async () => { const r = await upload('c1', 'besar.zip', BIG); assert.equal(r.status, 201, JSON.stringify(r.body)); assert.equal(r.body.size, BIG.length); });
  await check('N-55', 'Pelanggan', 'Unggah berkas 500 MB + 1 byte ditolak', 'Ditolak (HTTP 413)', async () => { const r = await upload('c1', 'terlalu-besar.zip', Buffer.concat([BIG, Buffer.from('x')])); assert.equal(r.status, 413); });
}
const failed = results.filter(r => !r.ok), pos = results.filter(r => r.id[0] === 'P'), neg = results.filter(r => r.id[0] === 'N');
console.log(`\nRINGKAS: ${results.length} kasus (positif ${pos.length}, negatif ${neg.length}); lulus ${results.length - failed.length}, gagal ${failed.length}`);
if (process.env.E2E_JSON) (await import('node:fs')).writeFileSync(process.env.E2E_JSON, JSON.stringify(results, null, 1));
process.exit(failed.length ? 1 : 0);

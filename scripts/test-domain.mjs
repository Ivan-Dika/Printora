import assert from 'node:assert/strict';
import {seed,transition,visible,paid} from '../lib/domain.ts';
const F1='11111111-1111-4111-8111-111111111111',F2='22222222-2222-4222-8222-222222222222',F3='33333333-3333-4333-8333-333333333333';
let s=seed();
const run=(user,action,data)=>{s=transition(s,user,action,data)};
run('c1','create',{title:'Pesanan uji',spec:'Banner 2 x 1 meter',qty:1});const orderId=s.orders[0].id;
assert.throws(()=>transition(s,'operator','verify',{orderId}),/akses/);
run('fo','verify',{orderId,total:100000,dp:40000,due:'2026-12-10',designerId:'design',operatorId:'operator'});
assert.throws(()=>transition(s,'fo','release',{orderId}),/final/);
assert.throws(()=>transition(s,'c2','approve',{orderId}),/akses/);
run('design','upload',{orderId,name:'contoh.png',file:F1,note:'Uji'});
run('c1','revision',{orderId,note:'Perbesar judul'});
run('design','upload',{orderId,name:'revisi.png',file:F2});
assert.throws(()=>transition(s,'design','final',{orderId}),/disetujui/);
run('c1','approve',{orderId});
assert.throws(()=>transition(s,'c1','revision',{orderId,note:'Ubah lagi'}),/sebelum/);
run('design','final',{orderId});
assert.throws(()=>transition(s,'fo','release',{orderId}),/DP/);
assert.throws(()=>transition(s,'c1','pay',{orderId,amount:40000,method:'Tunai'}),/peran/);
run('fo','pay',{orderId,amount:20000,method:'Tunai'});
assert.throws(()=>transition(s,'fo','release',{orderId}),/DP/);
run('fo','pay',{orderId,amount:20000,method:'Tunai'});run('fo','release',{orderId});run('operator','start',{orderId});
run('operator','qc',{orderId,pass:false,note:'Warna belum sesuai'});
assert.throws(()=>transition(s,'fo','ready',{orderId}),/lolos/);
run('operator','start',{orderId});run('operator','qc',{orderId,pass:true,note:'Semua sesuai'});run('fo','ready',{orderId});
assert.throws(()=>transition(s,'fo','handover',{orderId,recipient:'Alya'}),/lunas/);
assert.throws(()=>transition(s,'fo','pay',{orderId,amount:70000,method:'Tunai'}),/melebihi/);
run('fo','pay',{orderId,amount:60000,method:'QRIS'});run('fo','handover',{orderId,recipient:'Alya'});
assert.equal(s.orders[0].status,'Selesai');assert.equal(paid(s.orders[0]),100000);assert.equal(s.orders[0].designs.length,2);
assert.ok(!visible(s,s.users.find(u=>u.id==='c2')).some(o=>o.id===orderId));

// ---- Langsung cetak: berkas cetak final, tanpa desain Tim Desain, berkas terkunci setelah produksi ----
{
  const F4='44444444-4444-4444-8444-444444444444',F5='55555555-5555-4555-8555-555555555555';
  let t=seed();const go=(u,a,d)=>{t=transition(t,u,a,d)};
  go('c1','create',{title:'Cetak langsung',spec:'Spanduk 3 x 1 m',qty:1,mode:'cetak'});const id=t.orders[0].id;
  go('fo','verify',{orderId:id,total:100000,dp:40000,due:'2026-12-10',designerId:'design',operatorId:'operator'});
  assert.throws(()=>transition(t,'design','upload',{orderId:id,name:'x.png',file:F4}),/Langsung cetak/,'desainer tidak boleh mengunggah ke pesanan cetak');
  go('fo','pay',{orderId:id,amount:40000,method:'Tunai'});
  assert.throws(()=>transition(t,'fo','release',{orderId:id}),/berkas cetak final/,'tanpa berkas tidak bisa produksi');
  go('c1','attach',{orderId:id,fileName:'a.png',file:F4});
  go('c1','attach',{orderId:id,fileName:'b.png',file:F5});
  assert.throws(()=>transition(t,'fo','release',{orderId:id}),/berkas cetak final/,'dua berkas tanpa penunjukan ditolak');
  assert.throws(()=>transition(t,'fo','printfile',{orderId:id,attachmentId:'tidak-ada'}),/Pilih berkas/);
  assert.throws(()=>transition(t,'c1','printfile',{orderId:id,attachmentId:t.orders[0].attachments[0].id}),/peran/);
  go('fo','printfile',{orderId:id,attachmentId:t.orders[0].attachments[1].id});
  go('fo','release',{orderId:id});
  assert.equal(t.orders[0].printFile,t.orders[0].attachments[1].id);
  assert.throws(()=>transition(t,'c1','attach',{orderId:id,fileName:'c.png',file:F4}),/produksi/,'berkas terkunci setelah produksi');
  // satu berkas dipakai otomatis
  go('c2','create',{title:'Satu berkas',spec:'Stiker',qty:1,mode:'cetak'});const id2=t.orders[0].id;
  go('fo','verify',{orderId:id2,total:50000,dp:10000,due:'2026-12-10',designerId:'design',operatorId:'operator'});
  go('c2','attach',{orderId:id2,fileName:'a.png',file:F4});go('fo','pay',{orderId:id2,amount:10000,method:'Tunai'});go('fo','release',{orderId:id2});
  assert.equal(t.orders[0].status,'Siap produksi');assert.equal(t.orders[0].printFile,t.orders[0].attachments[0].id);
  // pesanan Desain dulu tidak punya printfile
  assert.throws(()=>transition(t,'fo','printfile',{orderId:'RPT-1001',attachmentId:'x'}),/Langsung cetak|akses|diverifikasi/);
  console.log('PASS: alur Langsung cetak (berkas cetak final, blok desain, kunci berkas).');
}
// Ketetapan 30 Okt 2026: berkas pelanggan, catatan kendala, pencatatan pemberitahuan (D-06)
{
 let t=seed();const go=(u,a,d)=>{t=transition(t,u,a,d)};
 assert.throws(()=>transition(t,'c1','create',{title:'X',spec:'Y',qty:1,file:'data:text/html;base64,aGk=',fileName:'a.html'}),/Unggah berkas/);
 go('c1','create',{title:'Dengan berkas',spec:'Banner',qty:1,file:F3,fileName:'logo.png'});
 const id=t.orders[0].id;assert.equal(t.orders[0].attachments.length,1);assert.equal(t.orders[0].attachments[0].name,'logo.png');
 assert.ok(visible(t,t.users.find(u=>u.id==='c1')).some(o=>o.id===id));
 go('fo','verify',{orderId:id,total:100000,dp:50000,due:'2026-12-10',designerId:'design',operatorId:'operator'});
 assert.throws(()=>transition(t,'operator','issue',{orderId:id,note:'Tinta habis'}),/produksi/);
 assert.throws(()=>transition(t,'fo','notify',{orderId:id,channel:'Telepon'}),/siap diambil/);
 go('design','upload',{orderId:id,name:'d.png',file:F1});go('c1','approve',{orderId:id});go('design','final',{orderId:id});
 go('fo','pay',{orderId:id,amount:50000,method:'Tunai'});go('fo','release',{orderId:id});
 assert.throws(()=>transition(t,'fo','issue',{orderId:id,note:'x'}),/peran/);
 go('operator','issue',{orderId:id,note:'Tinta habis'});assert.equal(t.orders[0].issues.length,1);
 go('operator','start',{orderId:id});go('operator','issue',{orderId:id,note:'Mesin macet'});assert.equal(t.orders[0].issues.length,2);
 go('operator','qc',{orderId:id,pass:true,note:'Sesuai'});go('fo','ready',{orderId:id});
 assert.throws(()=>transition(t,'fo','notify',{orderId:id,channel:'Surat'}),/saluran/);
 go('fo','notify',{orderId:id,channel:'WhatsApp',note:'Sudah dikabari'});assert.equal(t.orders[0].notifications.length,1);
 assert.equal(t.orders[0].status,'Siap diambil');
 go('fo','pay',{orderId:id,amount:50000,method:'QRIS'});go('fo','handover',{orderId:id,recipient:'Alya'});assert.equal(t.orders[0].status,'Selesai');
 // pesanan lama tanpa kolom baru tetap dapat diproses
 const old=structuredClone(seed());delete old.orders[3].issues;delete old.orders[3].notifications;
 const r=transition(old,'fo','notify',{orderId:old.orders[3].id,channel:'Telepon'});assert.equal(r.orders[3].notifications.length,1);
}
console.log('PASS: full order lifecycle, revision, role/ownership checks, DP gate, QC retry, overpayment rejection, paid handover, customer attachment, production issues, notification log.');


// ---------- Pemberitahuan status (fungsi murni) ----------
{
  const { statusNotices } = await import('../lib/messaging.mjs');
  const mk = (over) => ({ id: 'RPT-1', customerId: 'c', title: 'Banner', verified: true, total: 100000, dp: 40000, due: '2026-12-10', designs: [], payments: [], status: 'Desain', ...over });
  const st = (o) => ({ users: [{ id: 'c', name: 'Budi', phone: '081234567890', email: 'b@x.test' }], orders: [o] });
  const one = (a, b, re, base = '') => { const r = statusNotices(st(a), st(b), base); assert.equal(r.length, 1); assert.match(r[0].text, re); return r[0]; };
  one(mk({ status: 'Desain' }), mk({ status: 'Siap produksi' }), /antrean produksi/);
  one(mk({ status: 'Siap produksi' }), mk({ status: 'Dalam produksi' }), /mulai diproduksi/);
  one(mk({ status: 'Dalam produksi' }), mk({ status: 'Perbaikan' }), /belum lolos/);
  one(mk({ status: 'Perbaikan' }), mk({ status: 'Dalam produksi' }), /Perbaikan selesai/);
  one(mk({ status: 'Lolos pemeriksaan', payments: [{ amount: 40000 }] }), mk({ status: 'Siap diambil', payments: [{ amount: 40000 }] }), /siap diambil.*60\.000/);
  one(mk({ status: 'Siap diambil' }), mk({ status: 'Selesai' }), /diserahkan/);
  assert.equal(statusNotices(st(mk()), st(mk({ revisions: [{ text: 'x' }] }))).length, 0, 'revisi pelanggan tidak dinotifikasi');
  assert.equal(statusNotices({ users: [], orders: [] }, st(mk())).length, 0, 'pesanan baru diabaikan');
  const t = one(mk(), mk({ status: 'Siap produksi' }), /Detail di Ruang Kerja: https:\/\/p\.test\/operasional/, 'https://p.test');
  assert.deepEqual(t.contact, { phone: '081234567890', email: 'b@x.test' });
  console.log('PASS: pemberitahuan status per tahap.');
}

// ---- Notifikasi per peran dan templat pesan ----
{
  const { statusNotices, orderCreatedNotice } = await import('../lib/messaging.mjs');
  const { renderHtml, renderPlain, renderWhatsApp } = await import('../lib/mailtpl.mjs');
  const users = [
    { id: 'c', name: 'Budi', role: 'customer', phone: '081111111111', email: 'budi@x.test' },
    { id: 'fo', name: 'Dewi', role: 'fo', phone: '082222222222', email: 'fo@x.test' },
    { id: 'ds', name: 'Raka', role: 'designer', phone: '083333333333', email: 'ds@x.test' },
    { id: 'op', name: 'Agus', role: 'operator', phone: '084444444444', email: 'op@x.test' },
  ];
  const mk = (over) => ({ id: 'RPT-9', customerId: 'c', designerId: 'ds', operatorId: 'op', title: 'Banner <b>x</b>', spec: 'Flexi 3x1', qty: 2, mode: 'desain', verified: true, total: 100000, dp: 40000, due: '2026-12-10', designs: [], payments: [], revisions: [], attachments: [], status: 'Desain', ...over });
  const S = (o) => ({ users, orders: [o] });
  const who = (r) => r.map((x) => x.contact.email.split('@')[0] + ':' + x.kind).join(',');
  const d1 = { id: 'd1', version: 1, name: 'v1.png', file: '/api/files/11111111-1111-4111-8111-111111111111', approved: false, final: false };

  assert.equal(who(statusNotices({ users, orders: [] }, S(mk({ verified: false, status: 'Menunggu verifikasi' })))), 'fo:pesanan-masuk', 'pesanan baru hanya ke FO');
  assert.equal(who(statusNotices(S(mk({ verified: false, status: 'Menunggu verifikasi' })), S(mk()))), 'ds:tugas-desain,budi:verifikasi', 'verifikasi: desainer lalu pelanggan');
  const up = statusNotices(S(mk()), S(mk({ designs: [d1] })));
  assert.equal(who(up), 'budi:desain'); assert.deepEqual(up[0].notice.files, [{ file: d1.file, name: 'v1.png' }], 'berkas desain dilampirkan ke pelanggan');
  assert.equal(who(statusNotices(S(mk({ designs: [d1] })), S(mk({ designs: [d1], revisions: [{ text: 'Judul lebih besar' }] })))), 'ds:revisi');
  assert.equal(who(statusNotices(S(mk({ designs: [d1] })), S(mk({ designs: [{ ...d1, approved: true }] })))), 'ds:disetujui,fo:disetujui');
  assert.equal(who(statusNotices(S(mk({ designs: [{ ...d1, approved: true }] })), S(mk({ designs: [{ ...d1, approved: true, final: true }] })))), 'fo:final');
  const att = statusNotices(S(mk({ verified: false, status: 'Menunggu verifikasi' })), S(mk({ verified: false, status: 'Menunggu verifikasi', attachments: [{ id: 'a1', name: 'logo.png', file: '/api/files/22222222-2222-4222-8222-222222222222' }] })));
  assert.equal(who(att), 'fo:berkas'); assert.equal(att[0].notice.files[0].name, 'logo.png', 'FO menerima berkas pelanggan');
  const rel = statusNotices(S(mk({ designs: [{ ...d1, approved: true, final: true }] })), S(mk({ designs: [{ ...d1, approved: true, final: true }], status: 'Siap produksi' })));
  assert.equal(who(rel), 'op:antrean,budi:produksi', 'operator menerima berkas final, pelanggan terakhir'); assert.equal(rel[0].notice.files[0].name, 'v1.png');
  const cet = statusNotices(S(mk({ mode: 'cetak', attachments: [{ id: 'a1', name: 'a.pdf', file: '/api/files/a1' }, { id: 'a2', name: 'b.pdf', file: '/api/files/b2' }] })), S(mk({ mode: 'cetak', printFile: 'a2', status: 'Siap produksi', attachments: [{ id: 'a1', name: 'a.pdf', file: '/api/files/a1' }, { id: 'a2', name: 'b.pdf', file: '/api/files/b2' }] })));
  assert.equal(cet[0].notice.files[0].name, 'b.pdf', 'operator menerima berkas cetak final yang ditunjuk');
  assert.equal(who(statusNotices(S(mk({ status: 'Dalam produksi' })), S(mk({ status: 'Lolos pemeriksaan' })))), 'fo:lolos');
  assert.equal(who(statusNotices(S(mk({ status: 'Dalam produksi' })), S(mk({ status: 'Perbaikan', qc: 'Warna pudar' })))), 'fo:perbaikan,budi:produksi');
  const pay = statusNotices(S(mk()), { users: [...users], orders: [mk({ payments: [{ amount: 40000, method: 'QRIS', by: 'c' }] })] });
  assert.equal(who(pay), 'fo:bayar-pelanggan,budi:pembayaran', 'pembayaran pelanggan memberi tahu FO');
  assert.equal(who(statusNotices(S(mk()), { users, orders: [mk({ payments: [{ amount: 40000, method: 'Tunai', by: 'fo' }] })] })), 'budi:pembayaran', 'pembayaran oleh FO tidak diberitahukan ke FO');

  // templat
  const n = orderCreatedNotice({ name: 'Budi *Test*', orderId: 'RPT-9', product: '<script>alert(1)</script>', qty: 2, mode: 'cetak', username: 'budi1234', password: 'a*b_c~1', base: 'https://p.test' });
  const html = renderHtml(n), wa = renderWhatsApp(n), plain = renderPlain(n);
  assert.ok(!html.includes('<script>') && html.includes('&lt;script&gt;'), 'HTML di-escape');
  assert.ok(html.includes('href="https://p.test/operasional"') && html.includes('Printora') && html.includes('a*b_c~1'), 'HTML memuat tombol, merek, dan sandi utuh');
  assert.ok(wa.startsWith('*Printora* | Pesanan Anda kami terima') && wa.includes('Halo *Budi Test*') && wa.includes('Kata sandi sementara: a*b_c~1') && wa.includes('Detail di Ruang Kerja: https://p.test/operasional'), wa);
  assert.ok(plain.includes('Username: budi1234') && !plain.includes('*Printora*'));
  assert.ok(!renderHtml({ ...n, cta: { label: 'x', url: 'javascript:alert(1)' } }).includes('javascript:'), 'skema berbahaya ditolak');
  assert.ok(renderWhatsApp({ ...n, cta: { label: 'x', url: '' } }).includes('menu Masuk'), 'tanpa alamat situs: petunjuk teks');
  console.log('PASS: notifikasi per peran dan templat email/WhatsApp.');
}
